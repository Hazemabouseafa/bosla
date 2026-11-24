import * as path from 'node:path';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@bosla/db';
import { processAutoCaptionJob } from './captions';
import { runScheduledTasks } from './scheduler';
import { transcodeVideoToHls } from './transcoder';

const VIDEO_TRANSCODE_QUEUE = 'bosla-video-transcode';
const VIDEO_CAPTIONS_QUEUE = 'bosla-video-captions';
const COMMUNITY_NOTIFICATION_QUEUE = 'bosla-community-notifications';

interface TranscodeJobPayload {
  videoAssetId: string;
  sourcePath: string;
  instructorId: string;
}

interface CommunityNotificationJobPayload {
  userId: string;
  type:
    | 'COMMUNITY_NEW_LESSON_QUESTION'
    | 'COMMUNITY_NEW_COURSE_QUESTION'
    | 'COMMUNITY_INSTRUCTOR_REPLY'
    | 'COMMUNITY_COMMENT_REPLY'
    | 'COMMUNITY_ACCEPTED_ANSWER'
    | 'COMMUNITY_POST_MODERATED';
  titleAr: string;
  bodyAr: string;
  actionUrl: string;
  dedupKey: string;
  courseId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  lessonId?: string | null;
}

async function bootstrap() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const concurrency = Math.max(1, Math.min(8, Number(process.env.WORKER_CONCURRENCY || 1)));

  const worker = new Worker<TranscodeJobPayload>(
    VIDEO_TRANSCODE_QUEUE,
    async (job) => {
      console.log(`[Worker] Starting HLS transcode for videoAssetId=${job.data.videoAssetId}`);
      const res = await transcodeVideoToHls({
        prisma,
        videoAssetId: job.data.videoAssetId,
      });
      console.log(
        `[Worker] Completed HLS transcode for ${job.data.videoAssetId}: ${res.qualities
          .map((q) => q.label)
          .join(', ')}`,
      );
      return res;
    },
    {
      connection: connection as any,
      concurrency,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err);
  });

  const mediaRoot = path.resolve(
    process.env.MEDIA_ROOT || path.resolve(process.cwd(), '../../storage/media'),
  );
  const captionsWorker = new Worker<{ captionTrackId: string; videoAssetId: string }>(
    VIDEO_CAPTIONS_QUEUE,
    async (job) => {
      return processAutoCaptionJob({
        prisma,
        captionTrackId: job.data.captionTrackId,
        config: {
          mediaRoot,
          ffmpegPath: process.env.FFMPEG_PATH,
          whisperCliPath: process.env.ASR_WHISPER_CLI_PATH,
        },
      });
    },
    {
      connection: connection as any,
      concurrency: 1,
    },
  );

  captionsWorker.on('failed', (job, err) => {
    console.error(`[CaptionsWorker] Job ${job?.id} failed:`, err);
  });

  const notificationWorker = new Worker<{ items: CommunityNotificationJobPayload[] }>(
    COMMUNITY_NOTIFICATION_QUEUE,
    async (job) => {
      const items = job.data.items ?? [];
      if (items.length === 0) return { inserted: 0 };
      const res = await prisma.notification.createMany({
        data: items.map((item) => ({
          userId: item.userId,
          type: item.type,
          titleAr: item.titleAr,
          bodyAr: item.bodyAr,
          actionUrl: item.actionUrl,
          dedupKey: item.dedupKey,
          courseId: item.courseId ?? null,
          postId: item.postId ?? null,
          commentId: item.commentId ?? null,
          lessonId: item.lessonId ?? null,
        })),
        skipDuplicates: true,
      });
      return { inserted: res.count };
    },
    {
      connection: connection as any,
      concurrency: 2,
    },
  );

  notificationWorker.on('failed', (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed:`, err);
  });

  const interval = setInterval(async () => {
    try {
      const summary = await runScheduledTasks({ prisma });
      if (
        summary.publishedCourses > 0 ||
        summary.publishedPaths > 0 ||
        summary.cleanedUploads > 0
      ) {
        console.log('[Worker Scheduler]', summary);
      }
    } catch (err) {
      console.error('[Worker Scheduler] error:', err);
    }
  }, 60_000);

  const shutdown = async () => {
    clearInterval(interval);
    await worker.close();
    await captionsWorker.close();
    await notificationWorker.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(
    `BOSLA Academy Media Worker listening on queue="${VIDEO_TRANSCODE_QUEUE}" (concurrency=${concurrency})`,
  );
}

bootstrap().catch((err) => {
  console.error('Worker bootstrap failed:', err);
  process.exit(1);
});
