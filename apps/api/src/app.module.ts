import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CoreModule } from './core/core.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CommunityModule } from './modules/community/community.module';
import { EditorialModule } from './modules/editorial/editorial.module';
import { EventsModule } from './modules/events/events.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { FinanceModule } from './modules/finance/finance.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { CrmModule } from './modules/crm/crm.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { LmsAdvancedModule } from './modules/lms-advanced/lms-advanced.module';
import { SupportModule } from './modules/support/support.module';
import { HealthController } from './modules/health/health.controller';
import { InstructorModule } from './modules/instructor/instructor.module';
import { LearningModule } from './modules/learning/learning.module';
import { MembershipModule } from './modules/membership/membership.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
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
    NotificationsModule,
    CommunityModule,
    EventsModule,
    RbacModule,
    SellersModule,
    FinanceModule,
    CommerceModule,
    CrmModule,
    OrganizationsModule,
    LmsAdvancedModule,
    SupportModule,
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
