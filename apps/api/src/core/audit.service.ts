import { Inject, Injectable } from '@nestjs/common';
import type { UserRole } from '@bosla/db';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async log(params: {
    actorId?: string | null;
    actorRole?: UserRole | null;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorRole: params.actorRole ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: (params.metadata as any) ?? undefined,
        ipAddress: params.ipAddress,
      },
    });
  }
}
