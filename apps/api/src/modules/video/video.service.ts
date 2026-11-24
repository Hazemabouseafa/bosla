import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { UserRole } from '@bosla/db';
import { isAdminRole, type SystemRoleCode } from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import { PrismaService } from '../../core/prisma.service';
import { resolveUserAccess } from '../../core/rbac-resolver';
import { RedisService } from '../../core/redis.service';
import { MembershipService } from '../membership/membership.service';
import { MediaStorageService } from './media-storage.service';
import { runLocalHlsTranscode } from './local-hls-transcoder';
import { VideoCaptionsAndAnalyticsService } from './video-captions-analytics.service';

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
]);

const ALLOWED_HLS_PATH_RE =
  /^(master\.m3u8|(360p|480p|720p|1080p)\/(index\.m3u8|seg_\d{5}\.ts))$/;

const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const PUBLIC_COVER_IMAGE_RE = /^cover-[a-z0-9-]+\.(jpg|png|webp|gif)$/i;

function detectImageFormat(buffer: Buffer): { ext: '.jpg' | '.png' | '.webp' | '.gif'; mimeType: string } | null {
  if (buffer.byteLength < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mimeType: 'image/jpeg' };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: '.png', mimeType: 'image/png' };
  }
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { ext: '.webp', mimeType: 'image/webp' };
  }
  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return { ext: '.gif', mimeType: 'image/gif' };
  }
  return null;
}

@Injectable()
export class VideoService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
    @Inject(MembershipService) private readonly membership: MembershipService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(VideoCaptionsAndAnalyticsService)
    private readonly captionsAnalytics: VideoCaptionsAndAnalyticsService,
  ) {}

  async initiateUpload(params: {
    instructorId: string;
    userRole?: UserRole;
    userRoles?: readonly SystemRoleCode[];
    courseId?: string | null;
    titleAr: string;
    filename: string;
    mimeType: string;
    totalBytes: number;
    chunkSizeBytes?: number;
  }) {
    if (!ALLOWED_VIDEO_MIME_TYPES.has(params.mimeType.toLowerCase())) {
      throw new BadRequestException('نوع ملف الفيديو غير مدعوم (المدعوم: MP4, MOV, WebM, MKV)');
    }

    const maxBytes = Number(process.env.MAX_VIDEO_UPLOAD_BYTES || 2147483648);
    if (params.totalBytes <= 0 || params.totalBytes > maxBytes) {
      throw new BadRequestException(`حجم الفيديو يتجاوز الحد الأقصى المسموح (${Math.round(maxBytes / 1048576)} ميجابايت)`);
    }

    // Check instructor storage quota
    const quotaBytes = BigInt(process.env.INSTRUCTOR_STORAGE_QUOTA_BYTES || 21474836480);
    const existingAssets = await this.prisma.videoAsset.aggregate({
      where: { instructorId: params.instructorId },
      _sum: { sourceSizeBytes: true, hlsTotalBytes: true },
    });
    const currentUsage =
      (existingAssets._sum.sourceSizeBytes ?? 0n) + (existingAssets._sum.hlsTotalBytes ?? 0n);

    const isAdmin = isAdminRole(params.userRole, params.userRoles);

    if (!isAdmin && currentUsage + BigInt(params.totalBytes) > quotaBytes) {
      throw new BadRequestException('تجاوزت الحصة التخزينية المخصصة للمدرب');
    }

    if (params.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: params.courseId } });
      if (!course || (!isAdmin && course.instructorId !== params.instructorId)) {
        throw new ForbiddenException('لا تملك صلاحية الرفع لهذا الكورس');
      }
    }

    await this.storage.ensureDirectories();

    const chunkSize = params.chunkSizeBytes ?? 5 * 1024 * 1024; // 5MB default
    const totalChunks = Math.ceil(params.totalBytes / chunkSize);
    const ext = path.extname(params.filename).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.mp4';
    const safeFilename = `${randomUUID()}${ext}`;
    const tempRelPath = `${safeFilename}.part`;
    const tempAbsPath = this.storage.resolveSafeSubpath(this.storage.uploadTmpDir, tempRelPath);

    // Pre-create empty sparse file handle cleanly without buffering in memory
    const handle = await fs.open(tempAbsPath, 'w');
    await handle.close();

    const ttlHours = Number(process.env.VIDEO_UPLOAD_SESSION_TTL_HOURS || 24);
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

    const session = await this.prisma.videoUploadSession.create({
      data: {
        instructorId: params.instructorId,
        courseId: params.courseId ?? null,
        originalFilename: params.filename,
        safeFilename,
        mimeType: params.mimeType,
        totalBytes: BigInt(params.totalBytes),
        chunkSizeBytes: chunkSize,
        totalChunks,
        receivedChunks: [],
        tempFilePath: tempRelPath,
        status: 'INITIATED',
        expiresAt,
      },
    });

    return {
      sessionId: session.id,
      safeFilename,
      chunkSizeBytes: chunkSize,
      totalChunks,
      expiresAt,
      titleAr: params.titleAr,
    };
  }

  async uploadChunk(params: {
    sessionId: string;
    instructorId: string;
    userRole?: UserRole;
    userRoles?: readonly SystemRoleCode[];
    chunkIndex: number;
    chunkBuffer: Buffer;
  }) {
    const session = await this.prisma.videoUploadSession.findUnique({
      where: { id: params.sessionId },
    });
    if (
      !session ||
      (!isAdminRole(params.userRole, params.userRoles) &&
        session.instructorId !== params.instructorId)
    ) {
      throw new NotFoundException('جلسة الرفع غير موجودة');
    }
    if (session.status === 'CANCELLED' || session.status === 'COMPLETED' || session.status === 'EXPIRED') {
      throw new BadRequestException('جلسة الرفع منتهية أو ملغاة');
    }
    if (params.chunkIndex < 0 || params.chunkIndex >= session.totalChunks) {
      throw new BadRequestException('رقم الجزء غير صالح');
    }

    const tempAbsPath = this.storage.resolveSafeSubpath(
      this.storage.uploadTmpDir,
      session.tempFilePath,
    );
    const offset = params.chunkIndex * session.chunkSizeBytes;

    const handle = await fs.open(tempAbsPath, 'r+');
    try {
      await handle.write(params.chunkBuffer, 0, params.chunkBuffer.length, offset);
    } finally {
      await handle.close();
    }

    const receivedSet = new Set(session.receivedChunks);
    receivedSet.add(params.chunkIndex);
    const receivedChunks = Array.from(receivedSet).sort((a, b) => a - b);

    const stat = await fs.stat(tempAbsPath);
    const updated = await this.prisma.videoUploadSession.update({
      where: { id: session.id },
      data: {
        status: 'UPLOADING',
        receivedChunks,
        uploadedBytes: BigInt(stat.size),
      },
    });

    return {
      sessionId: updated.id,
      receivedChunks: updated.receivedChunks,
      totalChunks: updated.totalChunks,
      uploadedBytes: Number(updated.uploadedBytes),
      totalBytes: Number(updated.totalBytes),
    };
  }

  async getUploadSessionStatus(
    sessionId: string,
    instructorId: string,
    userRole?: UserRole,
    userRoles?: readonly SystemRoleCode[],
  ) {
    const session = await this.prisma.videoUploadSession.findUnique({
      where: { id: sessionId },
      include: { videoAsset: true },
    });
    if (!session || (!isAdminRole(userRole, userRoles) && session.instructorId !== instructorId)) {
      throw new NotFoundException('جلسة الرفع غير موجودة');
    }
    return {
      ...session,
      totalBytes: Number(session.totalBytes),
      uploadedBytes: Number(session.uploadedBytes),
    };
  }

  async completeUpload(params: {
    sessionId: string;
    instructorId: string;
    userRole?: UserRole;
    userRoles?: readonly SystemRoleCode[];
    titleAr: string;
  }) {
    const session = await this.prisma.videoUploadSession.findUnique({
      where: { id: params.sessionId },
    });
    if (
      !session ||
      (!isAdminRole(params.userRole, params.userRoles) &&
        session.instructorId !== params.instructorId)
    ) {
      throw new NotFoundException('جلسة الرفع غير موجودة');
    }
    if (session.status === 'COMPLETED') {
      const existing = await this.prisma.videoAsset.findUnique({
        where: { uploadSessionId: session.id },
      });
      if (existing) return existing;
    }

    if (session.receivedChunks.length < session.totalChunks) {
      throw new BadRequestException(
        `الرفع غير مكتمل (${session.receivedChunks.length} من ${session.totalChunks} أجزاء)`,
      );
    }

    await this.storage.ensureDirectories();
    const tempAbsPath = this.storage.resolveSafeSubpath(
      this.storage.uploadTmpDir,
      session.tempFilePath,
    );
    const destRelPath = session.safeFilename;
    const destAbsPath = this.storage.resolveSafeSubpath(this.storage.sourcesDir, destRelPath);

    await fs.rename(tempAbsPath, destAbsPath);
    const stat = await fs.stat(destAbsPath);

    const videoAsset = await this.prisma.$transaction(async (db) => {
      await db.videoUploadSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', uploadedBytes: BigInt(stat.size) },
      });

      return db.videoAsset.create({
        data: {
          instructorId: params.instructorId,
          uploadSessionId: session.id,
          titleAr: params.titleAr || session.originalFilename,
          originalFilename: session.originalFilename,
          sourcePath: destRelPath,
          status: 'QUEUED',
          sourceSizeBytes: BigInt(stat.size),
        },
      });
    });

    const jobId = await this.redis.enqueueVideoTranscode({
      videoAssetId: videoAsset.id,
      sourcePath: destRelPath,
      instructorId: params.instructorId,
    });

    await this.prisma.videoAsset.update({
      where: { id: videoAsset.id },
      data: { processingJobId: jobId },
    });

    if (jobId && jobId.startsWith('local-queued-')) {
      void runLocalHlsTranscode({
        prisma: this.prisma,
        storage: this.storage,
        videoAssetId: videoAsset.id,
      }).catch(() => {});
    }

    await this.audit.log({
      actorId: params.instructorId,
      actorRole: 'INSTRUCTOR',
      action: 'VIDEO_UPLOAD_COMPLETED',
      entityType: 'VideoAsset',
      entityId: videoAsset.id,
      metadata: { sourceSizeBytes: Number(stat.size), jobId },
    });

    return {
      ...videoAsset,
      sourceSizeBytes: Number(videoAsset.sourceSizeBytes),
      hlsTotalBytes: Number(videoAsset.hlsTotalBytes),
      processingJobId: jobId,
    };
  }

  async cancelUpload(
    sessionId: string,
    instructorId: string,
    userRole?: UserRole,
    userRoles?: readonly SystemRoleCode[],
  ) {
    const session = await this.prisma.videoUploadSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || (!isAdminRole(userRole, userRoles) && session.instructorId !== instructorId)) {
      throw new NotFoundException('جلسة الرفع غير موجودة');
    }

    const tempAbsPath = this.storage.resolveSafeSubpath(
      this.storage.uploadTmpDir,
      session.tempFilePath,
    );
    await fs.rm(tempAbsPath, { force: true });

    await this.prisma.videoUploadSession.update({
      where: { id: session.id },
      data: { status: 'CANCELLED' },
    });

    return { cancelled: true };
  }

  async cleanupAbandonedUploads() {
    const expired = await this.prisma.videoUploadSession.findMany({
      where: {
        status: { in: ['INITIATED', 'UPLOADING'] },
        expiresAt: { lte: new Date() },
      },
    });

    for (const s of expired) {
      const tempAbs = this.storage.resolveSafeSubpath(this.storage.uploadTmpDir, s.tempFilePath);
      await fs.rm(tempAbs, { force: true }).catch(() => {});
      await this.prisma.videoUploadSession.update({
        where: { id: s.id },
        data: { status: 'EXPIRED' },
      });
    }

    return { cleanedCount: expired.length };
  }

  /**
   * Authorizes video playback for a lesson and returns a short-lived signed HLS URL.
   * Never exposes permanent public video URLs.
   */
  async createLessonPlaybackSession(params: {
    userId?: string | null;
    userRole?: UserRole | null;
    userRoles?: readonly SystemRoleCode[];
    lessonId: string;
    authSessionId?: string;
    existingPlaybackSessionId?: string | null;
  }) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        videoAsset: true,
        section: {
          include: {
            courseVersion: { include: { course: true } },
          },
        },
      },
    });

    if (!lesson || !lesson.videoAsset) {
      throw new NotFoundException('فيديو الدرس غير متاح');
    }

    const course = lesson.section.courseVersion.course;
    const isVersionPublished =
      course.status === 'PUBLISHED' &&
      Boolean(course.publishedVersionId) &&
      course.publishedVersionId === lesson.section.courseVersion.id;
    const isOwnerOrAdmin =
      isAdminRole(params.userRole ?? undefined, params.userRoles) ||
      (Boolean(params.userId) && course.instructorId === params.userId);

    if (!isVersionPublished && !isOwnerOrAdmin) {
      const isCoInst = params.userId
        ? await this.membership.isUserAssignedInstructorForCourse(params.userId, course.id)
        : false;
      if (!isCoInst) {
        throw new ForbiddenException({
          code: 'COURSE_NOT_PUBLISHED',
          message: 'هذا الكورس غير منشور بعد ولا يمكن عرض محتواه قبل الاعتماد والنشر',
        });
      }
    }

    const access = await this.membership.checkCourseAccessForUser({
      userId: params.userId ?? null,
      userRole: params.userRole ?? null,
      userRoles: params.userRoles,
      courseId: course.id,
      isLessonFreePreview: isVersionPublished ? lesson.isFreePreview : false,
    });

    if (!access.allowed && !isOwnerOrAdmin) {
      await this.audit.log({
        actorId: params.userId ?? undefined,
        actorRole: params.userRole ?? undefined,
        action: 'VIDEO_PLAYBACK_DENIED',
        entityType: 'VideoAsset',
        entityId: lesson.videoAsset.id,
        metadata: { lessonId: lesson.id, reason: access.reason },
      });
      throw new ForbiddenException({
        code: access.reason,
        message: 'لا تملك صلاحية تشغيل هذا الدرس، يرجى الاشتراك في العضوية أو شراء الكورس أولًا',
      });
    }

    let activeVideoAsset = lesson.videoAsset;
    if (activeVideoAsset.status === 'READY' && activeVideoAsset.hlsMasterPath) {
      const masterAbs = this.storage.resolveSafeSubpath(
        this.storage.hlsDir,
        `${activeVideoAsset.id}/master.m3u8`,
      );
      if (!fsSync.existsSync(masterAbs) && activeVideoAsset.sourcePath) {
        const srcAbs = this.storage.resolveSafeSubpath(
          this.storage.sourcesDir,
          activeVideoAsset.sourcePath,
        );
        if (fsSync.existsSync(srcAbs)) {
          await runLocalHlsTranscode({
            prisma: this.prisma,
            storage: this.storage,
            videoAssetId: activeVideoAsset.id,
          });
          const refreshed = await this.prisma.videoAsset.findUnique({
            where: { id: activeVideoAsset.id },
          });
          if (refreshed) activeVideoAsset = refreshed;
        }
      }
    }

    if (activeVideoAsset.status !== 'READY' || !activeVideoAsset.hlsMasterPath) {
      throw new BadRequestException({
        code: 'VIDEO_NOT_READY',
        status: activeVideoAsset.status,
        processingProgress: activeVideoAsset.processingProgress,
        message:
          activeVideoAsset.status === 'FAILED'
            ? 'تعذر تجهيز ملف الفيديو للبث التكيفي — يرجى إعادة التجهيز من لوحة المحاضر'
            : 'اكتمل رفع الفيديو وجارٍ تجهيزه للبث التكيفي متعدد الجودات حالياً',
      });
    }

    const effectiveUserId = params.userId || 'visitor';
    const ttlSeconds = Number(process.env.PLAYBACK_TOKEN_TTL_SECONDS || 900);
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const telemetry = await this.captionsAnalytics.createOrTouchPlaybackTelemetry({
      userId: effectiveUserId,
      authSessionId: params.authSessionId,
      videoAssetId: activeVideoAsset.id,
      lessonId: lesson.id,
      courseId: course.id,
      existingPlaybackSessionId: params.existingPlaybackSessionId,
    });

    const token = this.storage.signPlaybackToken({
      userId: effectiveUserId,
      videoAssetId: activeVideoAsset.id,
      lessonId: lesson.id,
      sessionId: params.authSessionId,
      playbackSessionId: telemetry.id,
      exp,
    });

    const [watermark, captions, learnerRow] = await Promise.all([
      this.captionsAnalytics.buildSessionWatermarkForUser(effectiveUserId),
      this.captionsAnalytics.buildSignedCaptionTracksForPlayback(activeVideoAsset.id, token),
      params.userId
        ? this.prisma.user.findUnique({
            where: { id: params.userId },
            select: { preferredPlaybackRate: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      token,
      playbackSessionId: telemetry.id,
      refreshAfterSeconds: Math.max(15, ttlSeconds - 30),
      videoAssetId: activeVideoAsset.id,
      lessonId: lesson.id,
      durationSeconds: activeVideoAsset.durationSeconds,
      qualities: activeVideoAsset.qualities,
      isDownloadable: activeVideoAsset.isDownloadable,
      downloadUrl: activeVideoAsset.isDownloadable
        ? `/api/v1/videos/${encodeURIComponent(activeVideoAsset.id)}/download`
        : null,
      preferredPlaybackRate: learnerRow?.preferredPlaybackRate ?? 1,
      watermark,
      captions,
      expiresAt: new Date(exp * 1000).toISOString(),
      manifestUrl: `/api/v1/videos/stream/${activeVideoAsset.id}/master.m3u8?token=${encodeURIComponent(
        token,
      )}`,
      thumbnailUrl: activeVideoAsset.thumbnailPath
        ? `/api/v1/videos/thumbnail/${activeVideoAsset.id}?token=${encodeURIComponent(token)}`
        : null,
    };
  }

  /**
   * Validates short-lived playback token and safely serves either:
   * - rewritten .m3u8 playlists propagating the short-lived token to child playlists/segments
   * - .ts segments via Nginx X-Accel-Redirect (production) or streaming ReadStream (local dev)
   */
  async authorizeAndResolveStream(params: {
    videoAssetId: string;
    assetPath: string;
    token: string;
    originHeader?: string;
    refererHeader?: string;
  }) {
    this.captionsAnalytics.assertAllowedStreamOrigin(params.originHeader, params.refererHeader);

    if (!params.token) {
      throw new UnauthorizedException('رمز تشغيل الفيديو مطلوب');
    }

    const payload = this.storage.verifyPlaybackToken(params.token);
    if (!payload || payload.videoAssetId !== params.videoAssetId) {
      throw new UnauthorizedException('رمز تشغيل الفيديو غير صالح أو منتهي الصلاحية');
    }

    await this.captionsAnalytics.assertPlaybackSessionAlive(payload);

    const cleanPath = params.assetPath.replace(/^\/+/, '');
    if (!ALLOWED_HLS_PATH_RE.test(cleanPath)) {
      throw new ForbiddenException('مسار البث غير مسموح به');
    }

    // Re-verify user status and active entitlement dynamically
    const [user, lesson] = await Promise.all([
      payload.userId && payload.userId !== 'visitor'
        ? this.prisma.user.findUnique({ where: { id: payload.userId } })
        : Promise.resolve(null),
      this.prisma.lesson.findUnique({
        where: { id: payload.lessonId },
        include: { section: { include: { courseVersion: { include: { course: true } } } } },
      }),
    ]);

    if (!lesson || lesson.videoAssetId !== params.videoAssetId) {
      throw new ForbiddenException('تم إلغاء صلاحية تشغيل هذا المحتوى');
    }

    const course = lesson.section.courseVersion.course;
    const isVersionPublished =
      course.status === 'PUBLISHED' &&
      Boolean(course.publishedVersionId) &&
      course.publishedVersionId === lesson.section.courseVersion.id;

    if (payload.userId === 'visitor') {
      if (!isVersionPublished || (!lesson.isFreePreview && !course.isFree)) {
        throw new ForbiddenException('تم إلغاء صلاحية تشغيل هذا المحتوى للزوار');
      }
    } else {
      if (!user || user.status !== 'ACTIVE') {
        throw new ForbiddenException('تم إلغاء صلاحية تشغيل هذا المحتوى');
      }
      const resolvedAccess = await resolveUserAccess(this.prisma, user.id, user.role);
      const isOwnerOrAdmin =
        isAdminRole(user.role, resolvedAccess.roles) || course.instructorId === user.id;

      if (!isVersionPublished && !isOwnerOrAdmin) {
        const isCoInst = await this.membership.isUserAssignedInstructorForCourse(
          user.id,
          course.id,
        );
        if (!isCoInst) {
          throw new ForbiddenException('هذا الكورس غير منشور بعد');
        }
      }

      const access = await this.membership.checkCourseAccessForUser({
        userId: user.id,
        userRole: user.role,
        userRoles: resolvedAccess.roles,
        courseId: course.id,
        isLessonFreePreview: isVersionPublished ? lesson.isFreePreview : false,
      });
      if (!access.allowed && !isOwnerOrAdmin) {
        throw new ForbiddenException('انتهت صلاحية العضوية أو الوصول لهذا المحتوى');
      }
    }

    const absFile = this.storage.resolveSafeSubpath(
      this.storage.hlsDir,
      `${params.videoAssetId}/${cleanPath}`,
    );

    if (!fsSync.existsSync(absFile)) {
      throw new NotFoundException('ملف البث غير موجود على الخادم');
    }

    const stat = await fs.stat(absFile);

    if (cleanPath.endsWith('.m3u8')) {
      const rawManifest = await fs.readFile(absFile, 'utf8');
      const encodedToken = encodeURIComponent(params.token);
      const rewritten = rawManifest
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          const sep = trimmed.includes('?') ? '&' : '?';
          return `${trimmed}${sep}token=${encodedToken}`;
        })
        .join('\n');

      return {
        kind: 'manifest' as const,
        content: rewritten,
      };
    }

    if (user) {
      await this.prisma.videoPlaybackLog
        .create({
          data: {
            userId: user.id,
            videoAssetId: params.videoAssetId,
            lessonId: lesson.id,
            bytesServed: BigInt(stat.size),
          },
        })
        .catch(() => {});
    }

    return {
      kind: 'segment' as const,
      absFile,
      sizeBytes: stat.size,
      internalAccelPath: `${process.env.NGINX_INTERNAL_HLS_PREFIX || '/_internal_hls'}/${params.videoAssetId}/${cleanPath}`,
    };
  }

  async resolveThumbnail(
    videoAssetId: string,
    token: string,
    originHeader?: string,
    refererHeader?: string,
  ) {
    this.captionsAnalytics.assertAllowedStreamOrigin(originHeader, refererHeader);
    const payload = this.storage.verifyPlaybackToken(token);
    if (!payload || payload.videoAssetId !== videoAssetId) {
      throw new UnauthorizedException('رمز الوصول غير صالح');
    }
    await this.captionsAnalytics.assertPlaybackSessionAlive(payload);
    const asset = await this.prisma.videoAsset.findUnique({ where: { id: videoAssetId } });
    if (!asset?.thumbnailPath) throw new NotFoundException('الصورة المصغرة غير موجودة');

    const absFile = this.storage.resolveSafeSubpath(this.storage.thumbnailsDir, asset.thumbnailPath);
    if (!fsSync.existsSync(absFile)) throw new NotFoundException('ملف الصورة المصغرة مفقود');

    return {
      absFile,
      internalAccelPath: `${process.env.NGINX_INTERNAL_THUMBNAILS_PREFIX || '/_internal_thumbnails'}/${asset.thumbnailPath}`,
    };
  }

  async uploadCoverImage(params: {
    userId: string;
    userRole?: UserRole;
    originalFilename?: string;
    buffer: Buffer;
  }) {
    if (params.buffer.byteLength === 0 || params.buffer.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
      throw new BadRequestException('حجم الصورة غير صالح (الحد الأقصى 10 ميجابايت)');
    }

    const detected = detectImageFormat(params.buffer);
    if (!detected) {
      throw new BadRequestException('نوع ملف الصورة غير مدعوم (المدعوم: JPG, PNG, WebP, GIF)');
    }

    await this.storage.ensureDirectories();
    const filename = `cover-${randomUUID()}${detected.ext}`;
    const absPath = this.storage.resolveSafeSubpath(this.storage.thumbnailsDir, filename);
    await fs.writeFile(absPath, params.buffer);

    await this.audit.log({
      actorId: params.userId,
      actorRole: params.userRole || 'INSTRUCTOR',
      action: 'MEDIA_COVER_IMAGE_UPLOADED',
      entityType: 'MediaImage',
      entityId: filename,
      metadata: {
        originalFilename: params.originalFilename,
        mimeType: detected.mimeType,
        sizeBytes: params.buffer.byteLength,
      },
    });

    return {
      filename,
      url: `/api/v1/media/images/${filename}`,
      mimeType: detected.mimeType,
      sizeBytes: params.buffer.byteLength,
    };
  }

  resolvePublicImage(filename: string) {
    if (!PUBLIC_COVER_IMAGE_RE.test(filename)) {
      throw new NotFoundException('الصورة غير موجودة');
    }
    const absFile = this.storage.resolveSafeSubpath(this.storage.thumbnailsDir, filename);
    if (!fsSync.existsSync(absFile)) {
      throw new NotFoundException('ملف الصورة غير موجود');
    }
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';

    return { absFile, contentType };
  }

  async getInfrastructureHealthForAdmin() {
    const [disk, queue, processingStats, bandwidthAgg] = await Promise.all([
      this.storage.getDiskStats(),
      this.redis.getQueueStats(),
      this.prisma.videoAsset.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { sourceSizeBytes: true, hlsTotalBytes: true },
      }),
      this.prisma.videoPlaybackLog.aggregate({
        _sum: { bytesServed: true },
        _count: { _all: true },
      }),
    ]);

    return {
      disk,
      queue,
      processingStats: processingStats.map((row) => ({
        status: row.status,
        count: row._count._all,
        sourceBytes: Number(row._sum.sourceSizeBytes ?? 0n),
        hlsBytes: Number(row._sum.hlsTotalBytes ?? 0n),
      })),
      bandwidth: {
        totalBytesServed: Number(bandwidthAgg._sum.bytesServed ?? 0n),
        totalSegmentRequests: bandwidthAgg._count._all,
      },
    };
  }

  async listVideosForAdmin() {
    const assets = await this.prisma.videoAsset.findMany({
      include: {
        instructor: { select: { id: true, fullName: true, role: true } },
        _count: { select: { lessons: true, introForCourse: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    return assets.map((asset) => ({
      ...asset,
      sourceSizeBytes: Number(asset.sourceSizeBytes ?? 0n),
      hlsTotalBytes: Number(asset.hlsTotalBytes ?? 0n),
    }));
  }

  async deleteVideoAssetForAdmin(
    adminId: string,
    videoAssetId: string,
    options?: { force?: boolean; ip?: string },
  ) {
    const asset = await this.prisma.videoAsset.findUnique({
      where: { id: videoAssetId },
      include: { _count: { select: { lessons: true, introForCourse: true } } },
    });
    if (!asset) {
      throw new NotFoundException('أصل الفيديو غير موجود');
    }

    const totalLinks = asset._count.lessons + asset._count.introForCourse;
    if (totalLinks > 0 && !options?.force) {
      throw new BadRequestException(
        `الفيديو مرتبط حالياً بـ ${asset._count.lessons} درس و ${asset._count.introForCourse} مقدمة كورس. استخدم فك الارتباط والحذف لإزالته بأمان.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (asset._count.lessons > 0) {
        await tx.lesson.updateMany({
          where: { videoAssetId },
          data: { videoAssetId: null },
        });
      }
      if (asset._count.introForCourse > 0) {
        await tx.courseVersion.updateMany({
          where: { introVideoId: videoAssetId },
          data: { introVideoId: null },
        });
      }
      await tx.videoAsset.delete({ where: { id: videoAssetId } });
    });

    // Clean up physical media files safely within storage directories
    const pathsToRemove: string[] = [];
    if (asset.sourcePath) {
      pathsToRemove.push(this.storage.resolveSafeSubpath(this.storage.sourcesDir, asset.sourcePath));
    }
    if (asset.hlsMasterPath) {
      const hlsDirName = path.dirname(asset.hlsMasterPath);
      if (hlsDirName && hlsDirName !== '.') {
        pathsToRemove.push(this.storage.resolveSafeSubpath(this.storage.hlsDir, hlsDirName));
      }
    }
    if (asset.thumbnailPath) {
      pathsToRemove.push(
        this.storage.resolveSafeSubpath(this.storage.thumbnailsDir, asset.thumbnailPath),
      );
    }

    await Promise.all(
      pathsToRemove.map((target) => fs.rm(target, { recursive: true, force: true }).catch(() => {})),
    );

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_VIDEO_ASSET_DELETED',
      entityType: 'VideoAsset',
      entityId: videoAssetId,
      metadata: { titleAr: asset.titleAr, forced: Boolean(options?.force) },
      ipAddress: options?.ip,
    });

    return { deleted: true, id: videoAssetId };
  }

  async listCoverImagesForAdmin() {
    await this.storage.ensureDirectories();
    const entries = await fs.readdir(this.storage.thumbnailsDir, { withFileTypes: true }).catch(() => []);
    const coverFiles = entries
      .filter((entry) => entry.isFile() && PUBLIC_COVER_IMAGE_RE.test(entry.name))
      .map((entry) => entry.name);

    const [courseVersions, paths, diplomas, partners, offlineEvents] = await Promise.all([
      this.prisma.courseVersion.findMany({
        where: { thumbnailUrl: { not: null } },
        select: { titleAr: true, thumbnailUrl: true },
      }),
      this.prisma.learningPath.findMany({
        where: { thumbnailUrl: { not: null } },
        select: { titleAr: true, thumbnailUrl: true },
      }),
      this.prisma.diploma.findMany({
        where: { thumbnailUrl: { not: null } },
        select: { titleAr: true, thumbnailUrl: true },
      }),
      this.prisma.cmsPartner.findMany({
        where: { logoUrl: { not: null } },
        select: { nameAr: true, logoUrl: true },
      }),
      this.prisma.offlineEvent.findMany({
        where: { thumbnailUrl: { not: null } },
        select: { titleAr: true, thumbnailUrl: true },
      }),
    ]);

    const usageMap = new Map<string, string[]>();
    const addUsage = (url: string | null | undefined, label: string) => {
      if (!url) return;
      const match = url.match(/\/api\/v1\/media\/images\/([^/?#]+)/i);
      const name = match?.[1];
      if (!name) return;
      const existing = usageMap.get(name) ?? [];
      if (!existing.includes(label)) existing.push(label);
      usageMap.set(name, existing);
    };

    for (const cv of courseVersions) addUsage(cv.thumbnailUrl, `كورس: ${cv.titleAr}`);
    for (const lp of paths) addUsage(lp.thumbnailUrl, `مسار: ${lp.titleAr}`);
    for (const dp of diplomas) addUsage(dp.thumbnailUrl, `دبلومة: ${dp.titleAr}`);
    for (const pr of partners) addUsage(pr.logoUrl, `شريك: ${pr.nameAr}`);
    for (const ev of offlineEvents) addUsage(ev.thumbnailUrl, `فعالية أوفلاين: ${ev.titleAr}`);

    const items = await Promise.all(
      coverFiles.map(async (filename) => {
        const absFile = this.storage.resolveSafeSubpath(this.storage.thumbnailsDir, filename);
        const stat = await fs.stat(absFile).catch(() => null);
        const usedBy = usageMap.get(filename) ?? [];
        return {
          filename,
          url: `/api/v1/media/images/${filename}`,
          sizeBytes: stat?.size ?? 0,
          uploadedAt: stat?.mtime?.toISOString() ?? new Date().toISOString(),
          usedBy,
          inUse: usedBy.length > 0,
        };
      }),
    );

    return items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  async deleteCoverImageForAdmin(adminId: string, filename: string, ip?: string) {
    if (!PUBLIC_COVER_IMAGE_RE.test(filename)) {
      throw new BadRequestException('اسم ملف الصورة غير صالح');
    }

    const urlSuffix = `/api/v1/media/images/${filename}`;
    const [inUseCourse, inUseEvent, publishedLayouts] = await Promise.all([
      this.prisma.courseVersion.findFirst({
        where: {
          OR: [
            { thumbnailUrl: { contains: urlSuffix } },
            { posterUrl: { contains: urlSuffix } },
          ],
        },
        select: { titleAr: true },
      }),
      this.prisma.offlineEvent.findFirst({
        where: { thumbnailUrl: { contains: urlSuffix } },
        select: { titleAr: true },
      }),
      this.prisma.siteLayoutRevision.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true, pageKey: true, versionNumber: true, config: true },
      }),
    ]);
    if (inUseCourse) {
      throw new BadRequestException(
        `هذه الصورة مستخدمة حالياً كغلاف للكورس: ${inUseCourse.titleAr}. استبدل الغلاف أولاً قبل حذفها.`,
      );
    }
    if (inUseEvent) {
      throw new BadRequestException(
        `هذه الصورة مستخدمة حالياً كغلاف للفعالية: ${inUseEvent.titleAr}. استبدل الغلاف أولاً قبل حذفها.`,
      );
    }
    const usedInLiveLayout = publishedLayouts.find((rev) =>
      JSON.stringify(rev.config ?? {}).includes(filename),
    );
    if (usedInLiveLayout) {
      throw new BadRequestException(
        `هذه الصورة مرتبطة حالياً بإصدار منشور في تخصيص الموقع (الإصدار رقم ${usedInLiveLayout.versionNumber}). استبدلها أولاً قبل حذفها.`,
      );
    }

    const absFile = this.storage.resolveSafeSubpath(this.storage.thumbnailsDir, filename);
    if (!fsSync.existsSync(absFile)) {
      throw new NotFoundException('ملف الصورة غير موجود على الخادم');
    }

    await fs.unlink(absFile);

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_COVER_IMAGE_DELETED',
      entityType: 'MediaImage',
      entityId: filename,
      ipAddress: ip,
    });

    return { deleted: true, filename };
  }

  async retranscodeVideoAsset(params: {
    actorId: string;
    actorRole: UserRole;
    actorRoles?: readonly SystemRoleCode[];
    videoAssetId: string;
  }) {
    const asset = await this.prisma.videoAsset.findUnique({
      where: { id: params.videoAssetId },
    });
    if (!asset) {
      throw new NotFoundException('أصل الفيديو غير موجود');
    }
    const isAdmin = isAdminRole(params.actorRole, params.actorRoles);
    if (!isAdmin && asset.instructorId !== params.actorId) {
      throw new ForbiddenException('لا تملك صلاحية إعادة تجهيز هذا الفيديو');
    }

    const result = await runLocalHlsTranscode({
      prisma: this.prisma,
      storage: this.storage,
      videoAssetId: asset.id,
    });

    await this.audit.log({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: 'VIDEO_ASSET_RETRANSCODED',
      entityType: 'VideoAsset',
      entityId: asset.id,
      metadata: {
        status: result.status,
        durationSeconds: result.durationSeconds,
      },
    });

    return result;
  }

  async getVideoDiagnostics(params: {
    actorId: string;
    actorRole: UserRole;
    actorRoles?: readonly SystemRoleCode[];
    videoAssetId: string;
  }) {
    const asset = await this.prisma.videoAsset.findUnique({
      where: { id: params.videoAssetId },
      include: {
        uploadSession: {
          select: {
            id: true,
            status: true,
            totalChunks: true,
            receivedChunks: true,
            uploadedBytes: true,
            totalBytes: true,
          },
        },
        _count: { select: { lessons: true, playbackSessions: true } },
      },
    });
    if (!asset) {
      throw new NotFoundException('أصل الفيديو غير موجود');
    }
    const isAdmin = isAdminRole(params.actorRole, params.actorRoles);
    if (!isAdmin && asset.instructorId !== params.actorId) {
      throw new ForbiddenException('لا تملك صلاحية فحص تشخيص هذا الفيديو');
    }

    const sourceAbs = asset.sourcePath
      ? this.storage.resolveSafeSubpath(this.storage.sourcesDir, asset.sourcePath)
      : null;
    const masterAbs = asset.hlsMasterPath
      ? this.storage.resolveSafeSubpath(this.storage.hlsDir, `${asset.id}/master.m3u8`)
      : null;
    const thumbAbs = asset.thumbnailPath
      ? this.storage.resolveSafeSubpath(this.storage.thumbnailsDir, asset.thumbnailPath)
      : null;

    const sourceFileExists = Boolean(sourceAbs && fsSync.existsSync(sourceAbs));
    const masterManifestExists = Boolean(masterAbs && fsSync.existsSync(masterAbs));
    const thumbnailExists = Boolean(thumbAbs && fsSync.existsSync(thumbAbs));

    const qualities = Array.isArray(asset.qualities) ? (asset.qualities as any[]) : [];
    const variantChecks = qualities.map((q) => {
      const label = q?.label || q?.name || 'unknown';
      const rel = `${asset.id}/${label}/index.m3u8`;
      const abs = this.storage.resolveSafeSubpath(this.storage.hlsDir, rel);
      return {
        label,
        width: q?.width ?? null,
        height: q?.height ?? null,
        playlistExists: fsSync.existsSync(abs),
      };
    });

    const uploadCompleted =
      !asset.uploadSession || asset.uploadSession.status === 'COMPLETED' || sourceFileExists;
    const playbackReady =
      asset.status === 'READY' &&
      masterManifestExists &&
      variantChecks.length > 0 &&
      variantChecks.every((v) => v.playlistExists);

    return {
      videoAssetId: asset.id,
      titleAr: asset.titleAr,
      status: asset.status,
      stageLabelAr:
        playbackReady
          ? 'جاهز للتشغيل البث التكيفي (READY)'
          : asset.status === 'FAILED'
            ? 'فشل التجهيز — يتطلب إعادة التجهيز'
            : asset.status === 'PROCESSING'
              ? `جارٍ التجهيز (${asset.processingProgress}%)`
              : uploadCompleted
                ? 'اكتمل الرفع — في انتظار التجهيز'
                : 'جارٍ رفع الملف',
      uploadCompleted,
      playbackReady,
      processingProgress: asset.processingProgress,
      processingError: asset.processingError,
      durationSeconds: asset.durationSeconds,
      sourceResolution:
        asset.sourceWidth && asset.sourceHeight
          ? `${asset.sourceWidth}x${asset.sourceHeight}`
          : null,
      sourceSizeBytes: Number(asset.sourceSizeBytes ?? 0n),
      hlsTotalBytes: Number(asset.hlsTotalBytes ?? 0n),
      sourceFileExists,
      masterManifestExists,
      thumbnailExists,
      variants: variantChecks,
      linkedLessonsCount: asset._count.lessons,
      playbackSessionsCount: asset._count.playbackSessions,
      processedAt: asset.processedAt,
    };
  }

  async getLessonPlaybackReadiness(params: {
    userId?: string | null;
    userRole?: UserRole | null;
    userRoles?: readonly SystemRoleCode[];
    lessonId: string;
  }) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: params.lessonId },
      include: {
        videoAsset: true,
        section: {
          include: {
            courseVersion: { include: { course: true } },
          },
        },
      },
    });
    if (!lesson) {
      throw new NotFoundException('الدرس غير موجود');
    }

    const course = lesson.section.courseVersion.course;
    const isAdmin = isAdminRole(params.userRole ?? undefined, params.userRoles);
    const isOwner = Boolean(params.userId && course.instructorId === params.userId);
    const canRetranscode = isAdmin || isOwner;

    if (!lesson.videoAsset) {
      return {
        lessonId: lesson.id,
        hasVideo: false,
        uploadCompleted: false,
        readyForPlayback: false,
        stage: 'NO_VIDEO',
        stageLabelAr: 'لم يتم ربط ملف فيديو بهذا الدرس بعد',
        processingProgress: 0,
        canRetranscode,
      };
    }

    const va = lesson.videoAsset;
    const masterAbs = va.hlsMasterPath
      ? this.storage.resolveSafeSubpath(this.storage.hlsDir, `${va.id}/master.m3u8`)
      : null;
    const masterExists = Boolean(masterAbs && fsSync.existsSync(masterAbs));
    const readyForPlayback = va.status === 'READY' && masterExists;

    return {
      lessonId: lesson.id,
      videoAssetId: va.id,
      hasVideo: true,
      uploadCompleted: true,
      readyForPlayback,
      status: va.status,
      stage: readyForPlayback
        ? 'READY'
        : va.status === 'FAILED'
          ? 'FAILED'
          : va.status === 'PROCESSING'
            ? 'PROCESSING'
            : 'UPLOADED_QUEUED',
      stageLabelAr: readyForPlayback
        ? 'جاهز للتشغيل'
        : va.status === 'FAILED'
          ? 'تعذر تجهيز الفيديو للبث التكيفي'
          : va.status === 'PROCESSING'
            ? `اكتمل الرفع — جارٍ تجهيز الجودات (${va.processingProgress}%)`
            : 'اكتمل الرفع — في طابور التجهيز للبث التكيفي',
      processingProgress: va.processingProgress,
      processingError: va.processingError,
      durationSeconds: va.durationSeconds,
      qualities: va.qualities,
      canRetranscode,
    };
  }
}
