import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../core/prisma.service';
import { RedisService } from '../../core/redis.service';
import { MediaStorageService } from '../video/media-storage.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'System health check (PostgreSQL, Redis, Media storage)' })
  async check() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const [redisPing, queueStats] = await Promise.all([
      this.redis.ping(),
      this.redis.getQueueStats().catch(() => ({
        mode: 'redis' as const,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      })),
    ]);

    return {
      status: dbOk && redisPing.ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        postgres: dbOk ? 'up' : 'down',
        redis: redisPing.ok ? 'up' : 'down',
        mediaRootConfigured: Boolean(this.storage.mediaRoot),
      },
      queue: queueStats,
    };
  }
}
