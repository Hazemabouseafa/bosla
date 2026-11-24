import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { Queue } from 'bullmq';
import {
  buildLearnerWatermarkText,
  captionAutoGenerateSchema,
  captionUploadSchema,
  clampActiveWatchDelta,
  DEFAULT_WATERMARK_POLICY,
  evaluateCourseAccess,
  playbackHeartbeatSchema,
  validateAndNormalizeWebVtt,
  videoDownloadPolicySchema,
  watermarkPolicySchema,
  type WatermarkPolicyConfig,
} from '@bosla/shared';
import { PrismaService } from '../../core/prisma.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { MembershipService } from '../membership/membership.service';
import { MediaStorageService, type PlaybackTokenPayload } from './media-storage.service';

export const VIDEO_CAPTIONS_QUEUE = 'bosla-video-captions';

@Injectable()
export class VideoCaptionsAndAnalyticsService {
  private captionsQueue: Queue | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
    @Inject(MembershipService) private readonly membership: MembershipService,
  ) {
    if (process.env.ALLOW_INMEMORY_REDIS !== 'true' && process.env.REDIS_URL) {
      try {
        this.captionsQueue = new Queue(VIDEO_CAPTIONS_QUEUE, {
          connection: { url: process.env.REDIS_URL },
        });
      } catch {
        this.captionsQueue = null;
      }
    }
  }

  private isAdminUser(user: Pick<AuthenticatedContextUser, 'role' | 'roles'>): boolean {
    return (
      user.role === 'ADMIN' ||
      user.role === 'SUPER_ADMIN' ||
      Boolean(user.roles?.includes('ADMIN') || user.roles?.includes('SUPER_ADMIN'))
    );
  }

  private async assertStaffOwnsOrManagesVideo(
    actor: AuthenticatedContextUser,
    videoAssetId: string,
  ) {
    const asset = await this.prisma.videoAsset.findUnique({
      where: { id: videoAssetId },
      include: {
        lessons: {
          select: {
            section: {
              select: {
                courseVersion: {
                  select: {
                    courseId: true,
                    course: { select: { instructorId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!asset) {
      throw new NotFoundException('ملف الفيديو غير موجود');
    }
    if (this.isAdminUser(actor)) {
      return asset;
    }
    if (asset.instructorId === actor.id) {
      return asset;
    }
    const linkedCourseIds = Array.from(
      new Set(
        asset.lessons
          .map((l) => l.section?.courseVersion?.courseId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (linkedCourseIds.length > 0) {
      const coAssigned = await this.prisma.programInstructorAssignment.findFirst({
        where: {
          instructorId: actor.id,
          courseId: { in: linkedCourseIds },
        },
        select: { id: true },
      });
      if (coAssigned) return asset;
    }
    throw new ForbiddenException('غير مصرح لك بإدارة إعدادات هذا الفيديو');
  }

  assertAllowedStreamOrigin(originHeader?: string, refererHeader?: string): void {
    const ok = this.storage.isOriginOrRefererAllowed({
      originHeader,
      refererHeader,
      requireHeader: process.env.STRICT_STREAM_REFERER === 'true',
    });
    if (!ok) {
      throw new ForbiddenException('غير مصرح بتشغيل أو تضمين البث من هذا النطاق الخارجي');
    }
  }

  async assertPlaybackSessionAlive(payload: PlaybackTokenPayload): Promise<void> {
    if (!payload.sessionId) return;
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: { id: true, revokedAt: true, expiresAt: true, userId: true },
    });
    if (
      !session ||
      session.userId !== payload.userId ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('انتهت جلسة المشاهدة أو تم إبطالها — يرجى إعادة تسجيل الدخول');
    }
  }

  async getWatermarkPolicy(): Promise<WatermarkPolicyConfig> {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { key: 'video_watermark' },
    });
    if (!setting?.value || typeof setting.value !== 'object') {
      return DEFAULT_WATERMARK_POLICY;
    }
    const parsed = watermarkPolicySchema.safeParse(setting.value);
    return parsed.success ? parsed.data : DEFAULT_WATERMARK_POLICY;
  }

  async buildSessionWatermarkForUser(userId: string) {
    if (!userId || userId === 'visitor') {
      const policy = await this.getWatermarkPolicy();
      return {
        enabled: policy.enabled,
        text: policy.enabled ? 'BOSLA PREVIEW • معاينة مجانية' : '',
        opacity: policy.opacity,
        moveIntervalSeconds: policy.moveIntervalSeconds,
      };
    }
    const [policy, user] = await Promise.all([
      this.getWatermarkPolicy(),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true, phoneE164: true },
      }),
    ]);
    if (!user || !policy.enabled) {
      return {
        enabled: false,
        text: '',
        opacity: policy.opacity,
        moveIntervalSeconds: policy.moveIntervalSeconds,
      };
    }
    return {
      enabled: true,
      text: buildLearnerWatermarkText(user, policy),
      opacity: policy.opacity,
      moveIntervalSeconds: policy.moveIntervalSeconds,
    };
  }

  async createOrTouchPlaybackTelemetry(params: {
    userId: string;
    authSessionId?: string;
    videoAssetId: string;
    lessonId: string;
    courseId: string;
    existingPlaybackSessionId?: string | null;
  }) {
    if (!params.userId || params.userId === 'visitor') {
      return { id: 'visitor-preview-session' };
    }
    if (params.existingPlaybackSessionId) {
      const existing = await this.prisma.videoPlaybackSession.findUnique({
        where: { id: params.existingPlaybackSessionId },
      });
      if (
        existing &&
        existing.userId === params.userId &&
        existing.videoAssetId === params.videoAssetId
      ) {
        return existing;
      }
    }
    return this.prisma.videoPlaybackSession.create({
      data: {
        userId: params.userId,
        authSessionId: params.authSessionId ?? null,
        videoAssetId: params.videoAssetId,
        lessonId: params.lessonId,
        courseId: params.courseId,
      },
    });
  }

  async buildSignedCaptionTracksForPlayback(videoAssetId: string, token: string) {
    const tracks = await this.prisma.videoCaptionTrack.findMany({
      where: {
        videoAssetId,
        status: 'READY',
        isPublished: true,
        storageKey: { not: null },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return tracks.map((t) => ({
      id: t.id,
      language: t.language,
      labelAr: t.labelAr,
      isDefault: t.isDefault,
      cueCount: t.cueCount,
      url: `/api/v1/videos/captions/${encodeURIComponent(videoAssetId)}/${encodeURIComponent(t.language)}.vtt?token=${encodeURIComponent(token)}`,
    }));
  }

  async recordHeartbeat(
    user: AuthenticatedContextUser,
    lessonId: string,
    rawBody: unknown,
  ) {
    const input = playbackHeartbeatSchema.parse(rawBody);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        section: {
          include: {
            courseVersion: { select: { courseId: true } },
          },
        },
      },
    });
    if (!lesson || !lesson.videoAssetId) {
      throw new NotFoundException('درس الفيديو غير موجود');
    }

    const courseId = lesson.section.courseVersion.courseId;
    const now = new Date();

    let session = input.playbackSessionId
      ? await this.prisma.videoPlaybackSession.findUnique({
          where: { id: input.playbackSessionId },
        })
      : null;

    if (!session || session.userId !== user.id || session.videoAssetId !== lesson.videoAssetId) {
      const clampedFirst = clampActiveWatchDelta({
        reportedDeltaSeconds: input.activeDeltaSeconds,
        isPaused: input.isPaused,
        elapsedSinceLastHeartbeatMs: null,
        playbackRate: input.playbackRate,
      });
      session = await this.prisma.videoPlaybackSession.create({
        data: {
          userId: user.id,
          authSessionId: user.sessionId,
          videoAssetId: lesson.videoAssetId,
          lessonId: lesson.id,
          courseId,
          activeWatchSeconds: clampedFirst,
          lastPositionSeconds: input.positionSeconds,
          maxPositionSeconds: input.positionSeconds,
          clientDeviceKey: input.clientDeviceKey ?? null,
          lastHeartbeatAt: now,
        },
      });
      return {
        playbackSessionId: session.id,
        acceptedDeltaSeconds: clampedFirst,
        activeWatchSeconds: session.activeWatchSeconds,
      };
    }

    const elapsedMs =
      session.activeWatchSeconds === 0
        ? null
        : Math.max(0, now.getTime() - session.lastHeartbeatAt.getTime());
    const clampedDelta = clampActiveWatchDelta({
      reportedDeltaSeconds: input.activeDeltaSeconds,
      isPaused: input.isPaused,
      elapsedSinceLastHeartbeatMs: elapsedMs,
      playbackRate: input.playbackRate,
    });

    const updated = await this.prisma.videoPlaybackSession.update({
      where: { id: session.id },
      data: {
        activeWatchSeconds: { increment: clampedDelta },
        lastPositionSeconds: input.positionSeconds,
        maxPositionSeconds: Math.max(session.maxPositionSeconds, input.positionSeconds),
        lastHeartbeatAt: now,
        ...(input.clientDeviceKey ? { clientDeviceKey: input.clientDeviceKey } : {}),
      },
    });

    return {
      playbackSessionId: updated.id,
      acceptedDeltaSeconds: clampedDelta,
      activeWatchSeconds: updated.activeWatchSeconds,
    };
  }

  async getCourseVideoAnalyticsSummary(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        publishedVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: { lessons: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        draftVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: { lessons: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('الكورس غير موجود');

    const activeVersion = course.publishedVersion ?? course.draftVersion;
    const lessons = (activeVersion?.sections ?? []).flatMap((s) => s.lessons);

    const [sessions, progressRows] = await Promise.all([
      this.prisma.videoPlaybackSession.findMany({
        where: { courseId },
        select: {
          userId: true,
          lessonId: true,
          videoAssetId: true,
          activeWatchSeconds: true,
          maxPositionSeconds: true,
        },
      }),
      this.prisma.lessonProgress.findMany({
        where: { courseId },
        select: {
          userId: true,
          lessonStableKey: true,
          watchedSeconds: true,
          isCompleted: true,
          progressPercent: true,
        },
      }),
    ]);

    const viewerSet = new Set<string>();
    let meaningfulWatchSeconds = 0;
    for (const s of sessions) {
      if (s.activeWatchSeconds > 0) {
        viewerSet.add(s.userId);
        meaningfulWatchSeconds += s.activeWatchSeconds;
      }
    }
    for (const p of progressRows) {
      if (p.watchedSeconds > 0 || p.isCompleted) {
        viewerSet.add(p.userId);
      }
    }

    const uniqueViewers = viewerSet.size;
    const averageWatchSeconds =
      uniqueViewers > 0 ? Math.round(meaningfulWatchSeconds / uniqueViewers) : 0;

    const lessonAnalytics = lessons.map((les) => {
      const lesSessions = sessions.filter(
        (s) => s.lessonId === les.id || (les.videoAssetId && s.videoAssetId === les.videoAssetId),
      );
      const lesProgress = progressRows.filter((p) => p.lessonStableKey === les.stableKey);
      const lesViewers = new Set<string>([
        ...lesSessions.filter((s) => s.activeWatchSeconds > 0).map((s) => s.userId),
        ...lesProgress.filter((p) => p.watchedSeconds > 0 || p.isCompleted).map((p) => p.userId),
      ]);
      const lesWatchSeconds = lesSessions.reduce((acc, s) => acc + s.activeWatchSeconds, 0);
      const completionCount = lesProgress.filter((p) => p.isCompleted).length;
      const completionRatePercent =
        lesViewers.size > 0 ? Math.round((completionCount / lesViewers.size) * 100) : 0;

      return {
        lessonId: les.id,
        stableKey: les.stableKey,
        titleAr: les.titleAr,
        durationSeconds: les.durationSeconds,
        uniqueViewers: lesViewers.size,
        meaningfulWatchSeconds: lesWatchSeconds,
        completionCount,
        completionRatePercent,
      };
    });

    const totalCompletions = lessonAnalytics.reduce((acc, l) => acc + l.completionCount, 0);
    const possibleCompletions = Math.max(1, uniqueViewers * Math.max(1, lessons.length));
    const completionRatePercent =
      uniqueViewers > 0 ? Math.min(100, Math.round((totalCompletions / possibleCompletions) * 100)) : 0;

    return {
      uniqueViewers,
      meaningfulWatchSeconds,
      averageWatchSeconds,
      completionRatePercent,
      lessonAnalytics,
    };
  }

  // ---- Captions (Strictly Timed WebVTT Subtitles — Zero Searchable Transcripts) ----

  async listVideoCaptions(actor: AuthenticatedContextUser, videoAssetId: string) {
    await this.assertStaffOwnsOrManagesVideo(actor, videoAssetId);
    return this.prisma.videoCaptionTrack.findMany({
      where: { videoAssetId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async uploadManualWebVttCaption(
    actor: AuthenticatedContextUser,
    videoAssetId: string,
    rawBody: unknown,
  ) {
    await this.assertStaffOwnsOrManagesVideo(actor, videoAssetId);
    const parsed = captionUploadSchema.parse(rawBody);
    const vttCheck = validateAndNormalizeWebVtt(parsed.vttContent);
    if (!vttCheck.valid) {
      throw new BadRequestException(vttCheck.errorAr || 'ملف WebVTT غير صالح');
    }

    await this.storage.ensureDirectories();
    const safeLang = parsed.language.toLowerCase();
    const relKey = `${videoAssetId}/${safeLang}.vtt`;
    const absFile = this.storage.resolveSafeSubpath(this.storage.captionsDir, relKey);
    await fs.mkdir(path.dirname(absFile), { recursive: true });
    await fs.writeFile(absFile, vttCheck.normalizedVtt, 'utf8');

    const saved = await this.prisma.$transaction(async (tx) => {
      if (parsed.isDefault) {
        await tx.videoCaptionTrack.updateMany({
          where: { videoAssetId },
          data: { isDefault: false },
        });
      }
      return tx.videoCaptionTrack.upsert({
        where: {
          videoAssetId_language: {
            videoAssetId,
            language: safeLang,
          },
        },
        update: {
          labelAr: parsed.labelAr,
          source: 'MANUAL',
          status: 'READY',
          storageKey: relKey,
          cueCount: vttCheck.cueCount,
          isDefault: parsed.isDefault ?? false,
          isPublished: parsed.isPublished ?? true,
          errorMessageAr: null,
          updatedById: actor.id,
          generatedAt: new Date(),
        },
        create: {
          videoAssetId,
          language: safeLang,
          labelAr: parsed.labelAr,
          source: 'MANUAL',
          status: 'READY',
          storageKey: relKey,
          cueCount: vttCheck.cueCount,
          isDefault: parsed.isDefault ?? false,
          isPublished: parsed.isPublished ?? true,
          updatedById: actor.id,
          generatedAt: new Date(),
        },
      });
    });

    return saved;
  }

  async deleteVideoCaption(
    actor: AuthenticatedContextUser,
    videoAssetId: string,
    language: string,
  ) {
    await this.assertStaffOwnsOrManagesVideo(actor, videoAssetId);
    const safeLang = language.trim().toLowerCase();
    const existing = await this.prisma.videoCaptionTrack.findUnique({
      where: { videoAssetId_language: { videoAssetId, language: safeLang } },
    });
    if (!existing) {
      throw new NotFoundException('مسار الترجمة غير موجود');
    }
    if (existing.storageKey) {
      const absFile = this.storage.resolveSafeSubpath(
        this.storage.captionsDir,
        existing.storageKey,
      );
      await fs.rm(absFile, { force: true }).catch(() => {});
    }
    await this.prisma.videoCaptionTrack.delete({ where: { id: existing.id } });
    return { deleted: true, id: existing.id, language: safeLang };
  }

  async enqueueAutoCaptionGeneration(
    actor: AuthenticatedContextUser,
    videoAssetId: string,
    rawBody: unknown,
  ) {
    await this.assertStaffOwnsOrManagesVideo(actor, videoAssetId);
    const parsed = captionAutoGenerateSchema.parse(rawBody ?? {});
    const safeLang = parsed.language.toLowerCase();
    const hasLocalEngine = Boolean((process.env.ASR_WHISPER_CLI_PATH || '').trim());

    const blockedImmediately = !hasLocalEngine && !this.captionsQueue;
    const blockedMsg =
      'التوليد التلقائي للترجمة متوقف حالياً (BLOCKED): لا يوجد محرك تفريغ صوتي محلي (Whisper CLI) مضبوط في ASR_WHISPER_CLI_PATH حفاظاً على خصوصية المحاضرات وعدم إرسالها لأي خدمة خارجية. يمكنك رفع أو تحرير ملف WebVTT يدوياً، أو ضبط المحرك المحلي ثم إعادة المحاولة.';

    const track = await this.prisma.videoCaptionTrack.upsert({
      where: {
        videoAssetId_language: {
          videoAssetId,
          language: safeLang,
        },
      },
      update: {
        labelAr: parsed.labelAr,
        source: 'AUTO',
        status: blockedImmediately ? 'BLOCKED' : 'PENDING',
        errorMessageAr: blockedImmediately ? blockedMsg : null,
        updatedById: actor.id,
      },
      create: {
        videoAssetId,
        language: safeLang,
        labelAr: parsed.labelAr,
        source: 'AUTO',
        status: blockedImmediately ? 'BLOCKED' : 'PENDING',
        errorMessageAr: blockedImmediately ? blockedMsg : null,
        updatedById: actor.id,
      },
    });

    if (this.captionsQueue) {
      const job = await this.captionsQueue.add(
        'generate-vtt',
        { captionTrackId: track.id, videoAssetId },
        { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
      );
      return this.prisma.videoCaptionTrack.update({
        where: { id: track.id },
        data: { jobId: String(job.id) },
      });
    }

    return track;
  }

  async resolveAuthorizedCaptionFile(params: {
    videoAssetId: string;
    langFilename: string;
    token?: string;
    originHeader?: string;
    refererHeader?: string;
  }): Promise<{ absFile: string; relKey: string }> {
    this.assertAllowedStreamOrigin(params.originHeader, params.refererHeader);
    if (!params.token) {
      throw new UnauthorizedException('رمز صلاحية ملف الترجمة مفقود');
    }
    const payload = this.storage.verifyPlaybackToken(params.token);
    if (!payload || payload.videoAssetId !== params.videoAssetId) {
      throw new UnauthorizedException('رمز صلاحية ملف الترجمة غير صالح أو منتهي');
    }
    await this.assertPlaybackSessionAlive(payload);

    const lang = params.langFilename.replace(/\.vtt$/i, '').trim().toLowerCase();
    const track = await this.prisma.videoCaptionTrack.findUnique({
      where: {
        videoAssetId_language: {
          videoAssetId: params.videoAssetId,
          language: lang,
        },
      },
    });
    if (!track || track.status !== 'READY' || !track.isPublished || !track.storageKey) {
      throw new NotFoundException('ملف الترجمة غير متاح');
    }

    const absFile = this.storage.resolveSafeSubpath(this.storage.captionsDir, track.storageKey);
    if (!fsSync.existsSync(absFile)) {
      throw new NotFoundException('ملف الترجمة غير موجود على وحدة التخزين');
    }
    return { absFile, relKey: track.storageKey };
  }

  // ---- Download Control (VideoAsset) ----

  async updateVideoDownloadPolicy(
    actor: AuthenticatedContextUser,
    videoAssetId: string,
    rawBody: unknown,
  ) {
    await this.assertStaffOwnsOrManagesVideo(actor, videoAssetId);
    const parsed = videoDownloadPolicySchema.parse(rawBody);
    return this.prisma.videoAsset.update({
      where: { id: videoAssetId },
      data: { isDownloadable: parsed.isDownloadable },
      select: { id: true, titleAr: true, isDownloadable: true },
    });
  }

  async resolveAuthorizedVideoDownload(
    user: AuthenticatedContextUser,
    videoAssetId: string,
  ): Promise<{ absFile: string; relSourcePath: string; filename: string }> {
    const asset = await this.prisma.videoAsset.findUnique({
      where: { id: videoAssetId },
      include: {
        lessons: {
          include: {
            section: {
              include: {
                courseVersion: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('ملف الفيديو غير موجود');
    }

    const isAdmin = this.isAdminUser(user);
    const isOwner = asset.instructorId === user.id;

    if (!asset.isDownloadable && !isAdmin) {
      throw new ForbiddenException('تحميل ملف هذا الفيديو غير مسموح به وفق سياسة حماية المحتوى');
    }

    if (!isAdmin && !isOwner) {
      const summary = await this.membership.getMyMembershipSummary(user.id);
      let entitled = false;
      for (const lesson of asset.lessons) {
        const course = lesson.section?.courseVersion?.course;
        if (!course) continue;
        const decision = evaluateCourseAccess({
          isCoursePublished: course.status === 'PUBLISHED',
          isCourseFree: course.isFree,
          isLessonFreePreview: lesson.isFreePreview,
          isAdmin: false,
          isCourseOwnerInstructor: course.instructorId === user.id,
          directPurchasedCourseIds: summary.entitledCourseIds,
          activeSubscriptions: summary.activeSubscription
            ? [
                {
                  status: 'ACTIVE',
                  currentPeriodEnd: new Date(summary.activeSubscription.currentPeriodEnd),
                  entitledCourseIds: summary.entitledCourseIds,
                },
              ]
            : [],
          courseId: course.id,
        });
        if (decision.allowed) {
          entitled = true;
          break;
        }
      }
      if (!entitled) {
        throw new ForbiddenException('يلزم تفعيل صلاحية الكورس أولاً لتحميل هذه المحاضرة');
      }
    }

    const absFile = this.storage.resolveSafeSubpath(this.storage.sourcesDir, asset.sourcePath);
    if (!fsSync.existsSync(absFile)) {
      throw new NotFoundException('الملف الأصلي غير متاح للتنزيل حالياً');
    }

    return {
      absFile,
      relSourcePath: asset.sourcePath,
      filename: asset.originalFilename || `${asset.id}.mp4`,
    };
  }
}
