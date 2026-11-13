import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@bosla/db';
import { runScheduledTasks } from './scheduler';
import { transcodeVideoToHls } from './transcoder';

const VIDEO_TRANSCODE_QUEUE = 'bosla-video-transcode';

interface TranscodeJobPayload {
  videoAssetId: string;
  sourcePath: string;
  instructorId: string;
}

async function bootstrap() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const concurrency = Math.max(1, Math.min(8, Number(process.env.WORKER_CONCURRENCY || 2)));

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
