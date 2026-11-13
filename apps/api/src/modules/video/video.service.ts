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
import { AuditService } from '../../core/audit.service';
import { PrismaService } from '../../core/prisma.service';
import { RedisService } from '../../core/redis.service';
import { MembershipService } from '../membership/membership.service';
import { MediaStorageService } from './media-storage.service';

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
]);

const ALLOWED_HLS_PATH_RE =
  /^(master\.m3u8|(360p|480p|720p|1080p)\/(index\.m3u8|seg_\d{5}\.ts))$/;

@Injectable()
export class VideoService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
    @Inject(MembershipService) private readonly membership: MembershipService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async initiateUpload(params: {
    instructorId: string;
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

    if (currentUsage + BigInt(params.totalBytes) > quotaBytes) {
      throw new BadRequestException('تجاوزت الحصة التخزينية المخصصة للمدرب');
    }

    if (params.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: params.courseId } });
      if (!course || course.instructorId !== params.instructorId) {
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
    chunkIndex: number;
    chunkBuffer: Buffer;
  }) {
    const session = await this.prisma.videoUploadSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!session || session.instructorId !== params.instructorId) {
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

  async getUploadSessionStatus(sessionId: string, instructorId: string) {
    const session = await this.prisma.videoUploadSession.findUnique({
      where: { id: sessionId },
      include: { videoAsset: true },
    });
    if (!session || session.instructorId !== instructorId) {
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
    titleAr: string;
  }) {
    const session = await this.prisma.videoUploadSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!session || session.instructorId !== params.instructorId) {
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

  async cancelUpload(sessionId: string, instructorId: string) {
    const session = await this.prisma.videoUploadSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.instructorId !== instructorId) {
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
    userId: string;
    userRole: UserRole;
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

    if (!lesson || !lesson.videoAsset) {
      throw new NotFoundException('فيديو الدرس غير متاح');
    }

    const course = lesson.section.courseVersion.course;
    const access = await this.membership.checkCourseAccessForUser({
      userId: params.userId,
      userRole: params.userRole,
      courseId: course.id,
      isLessonFreePreview: lesson.isFreePreview,
    });

    if (!access.allowed) {
      await this.audit.log({
        actorId: params.userId,
        actorRole: params.userRole,
        action: 'VIDEO_PLAYBACK_DENIED',
        entityType: 'VideoAsset',
        entityId: lesson.videoAsset.id,
        metadata: { lessonId: lesson.id, reason: access.reason },
      });
      throw new ForbiddenException({
        code: access.reason,
        message: 'لا تملك صلاحية تشغيل هذا الدرس، يرجى الاشتراك في العضوية أولًا',
      });
    }

    if (lesson.videoAsset.status !== 'READY' || !lesson.videoAsset.hlsMasterPath) {
      throw new BadRequestException('الفيديو قيد المعالجة حاليًا وسيكون متاحًا قريبًا');
    }

    const ttlSeconds = Number(process.env.PLAYBACK_TOKEN_TTL_SECONDS || 120);
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = this.storage.signPlaybackToken({
      userId: params.userId,
      videoAssetId: lesson.videoAsset.id,
      lessonId: lesson.id,
      exp,
    });

    return {
      videoAssetId: lesson.videoAsset.id,
      lessonId: lesson.id,
      durationSeconds: lesson.videoAsset.durationSeconds,
      qualities: lesson.videoAsset.qualities,
      expiresAt: new Date(exp * 1000).toISOString(),
      manifestUrl: `/api/v1/videos/stream/${lesson.videoAsset.id}/master.m3u8?token=${encodeURIComponent(
        token,
      )}`,
      thumbnailUrl: lesson.videoAsset.thumbnailPath
        ? `/api/v1/videos/thumbnail/${lesson.videoAsset.id}?token=${encodeURIComponent(token)}`
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
  }) {
    if (!params.token) {
      throw new UnauthorizedException('رمز تشغيل الفيديو مطلوب');
    }

    const payload = this.storage.verifyPlaybackToken(params.token);
    if (!payload || payload.videoAssetId !== params.videoAssetId) {
      throw new UnauthorizedException('رمز تشغيل الفيديو غير صالح أو منتهي الصلاحية');
    }

    const cleanPath = params.assetPath.replace(/^\/+/, '');
    if (!ALLOWED_HLS_PATH_RE.test(cleanPath)) {
      throw new ForbiddenException('مسار البث غير مسموح به');
    }

    // Re-verify user status and active entitlement dynamically
    const [user, lesson] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: payload.userId } }),
      this.prisma.lesson.findUnique({
        where: { id: payload.lessonId },
        include: { section: { include: { courseVersion: { include: { course: true } } } } },
      }),
    ]);

    if (!user || user.status !== 'ACTIVE' || !lesson || lesson.videoAssetId !== params.videoAssetId) {
      throw new ForbiddenException('تم إلغاء صلاحية تشغيل هذا المحتوى');
    }

    const access = await this.membership.checkCourseAccessForUser({
      userId: user.id,
      userRole: user.role,
      courseId: lesson.section.courseVersion.course.id,
      isLessonFreePreview: lesson.isFreePreview,
    });
    if (!access.allowed) {
      throw new ForbiddenException('انتهت صلاحية العضوية أو الوصول لهذا المحتوى');
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

    return {
      kind: 'segment' as const,
      absFile,
      sizeBytes: stat.size,
      internalAccelPath: `${process.env.NGINX_INTERNAL_HLS_PREFIX || '/_internal_hls'}/${params.videoAssetId}/${cleanPath}`,
    };
  }

  async resolveThumbnail(videoAssetId: string, token: string) {
    const payload = this.storage.verifyPlaybackToken(token);
    if (!payload || payload.videoAssetId !== videoAssetId) {
      throw new UnauthorizedException('رمز الوصول غير صالح');
    }
    const asset = await this.prisma.videoAsset.findUnique({ where: { id: videoAssetId } });
    if (!asset?.thumbnailPath) throw new NotFoundException('الصورة المصغرة غير موجودة');

    const absFile = this.storage.resolveSafeSubpath(this.storage.thumbnailsDir, asset.thumbnailPath);
    if (!fsSync.existsSync(absFile)) throw new NotFoundException('ملف الصورة المصغرة مفقود');

    return {
      absFile,
      internalAccelPath: `${process.env.NGINX_INTERNAL_THUMBNAILS_PREFIX || '/_internal_thumbnails'}/${asset.thumbnailPath}`,
    };
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
}
