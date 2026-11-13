import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const VIDEO_TRANSCODE_QUEUE = 'bosla-video-transcode';

export interface VideoTranscodeJobPayload {
  videoAssetId: string;
  sourcePath: string;
  instructorId: string;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private transcodeQueue: Queue<VideoTranscodeJobPayload> | null = null;
  private readonly memoryCounters = new Map<string, { count: number; expiresAt: number }>();

  get isInMemoryFallback(): boolean {
    return process.env.ALLOW_INMEMORY_REDIS === 'true' && !this.client;
  }

  getClient(): Redis | null {
    if (this.client) return this.client;
    if (process.env.ALLOW_INMEMORY_REDIS === 'true') {
      return null;
    }
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });
    return this.client;
  }

  async ping(): Promise<{ ok: boolean; mode: 'redis' | 'memory-fallback' }> {
    const client = this.getClient();
    if (!client) {
      return { ok: true, mode: 'memory-fallback' };
    }
    try {
      const res = await client.ping();
      return { ok: res === 'PONG', mode: 'redis' };
    } catch {
      return { ok: false, mode: 'redis' };
    }
  }

  /**
   * Sliding-window rate limiter used for recovery codes, auth attempts, and lead submissions.
   */
  async incrementRateLimit(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttlSeconds: number }> {
    const client = this.getClient();
    if (client) {
      try {
        const count = await client.incr(key);
        if (count === 1) {
          await client.expire(key, windowSeconds);
        }
        const ttl = await client.ttl(key);
        return { count, ttlSeconds: ttl > 0 ? ttl : windowSeconds };
      } catch {
        // Fall through to process-local counter only if explicitly permitted
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Redis unavailable for security rate limiting');
        }
      }
    }

    const now = Date.now();
    const existing = this.memoryCounters.get(key);
    if (!existing || existing.expiresAt <= now) {
      this.memoryCounters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return { count: 1, ttlSeconds: windowSeconds };
    }
    existing.count += 1;
    return {
      count: existing.count,
      ttlSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
    };
  }

  async enqueueVideoTranscode(payload: VideoTranscodeJobPayload): Promise<string | null> {
    if (process.env.ALLOW_INMEMORY_REDIS === 'true') {
      return `local-queued-${payload.videoAssetId}`;
    }
    if (!this.transcodeQueue) {
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      this.transcodeQueue = new Queue<VideoTranscodeJobPayload>(VIDEO_TRANSCODE_QUEUE, {
        connection: { url },
      });
    }
    const job = await this.transcodeQueue.add('transcode', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
    return job.id ?? null;
  }

  async getQueueStats(): Promise<{
    mode: 'redis' | 'memory-fallback';
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    if (process.env.ALLOW_INMEMORY_REDIS === 'true') {
      return { mode: 'memory-fallback', waiting: 0, active: 0, completed: 0, failed: 0 };
    }
    if (!this.transcodeQueue) {
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      this.transcodeQueue = new Queue<VideoTranscodeJobPayload>(VIDEO_TRANSCODE_QUEUE, {
        connection: { url },
      });
    }
    const counts = await this.transcodeQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
    );
    return {
      mode: 'redis',
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.transcodeQueue) {
      await this.transcodeQueue.close();
    }
    if (this.client) {
      await this.client.quit();
    }
  }
}
