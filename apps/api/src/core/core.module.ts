import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CsrfGuard, OptionalSessionAuthGuard, RolesGuard, SessionAuthGuard } from './guards';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    PrismaService,
    RedisService,
    AuditService,
    SessionAuthGuard,
    OptionalSessionAuthGuard,
    RolesGuard,
    CsrfGuard,
  ],
  exports: [
    PrismaService,
    RedisService,
    AuditService,
    SessionAuthGuard,
    OptionalSessionAuthGuard,
    RolesGuard,
    CsrfGuard,
  ],
})
export class CoreModule {}
