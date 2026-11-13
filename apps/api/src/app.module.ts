import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CoreModule } from './core/core.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { EditorialModule } from './modules/editorial/editorial.module';
import { HealthController } from './modules/health/health.controller';
import { InstructorModule } from './modules/instructor/instructor.module';
import { LearningModule } from './modules/learning/learning.module';
import { MembershipModule } from './modules/membership/membership.module';
import { VideoModule } from './modules/video/video.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: process.env.NODE_ENV === 'test' ? 2000 : 180,
      },
    ]),
    CoreModule,
    AuthModule,
    CatalogModule,
    InstructorModule,
    EditorialModule,
    AdminModule,
    VideoModule,
    MembershipModule,
    LearningModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
