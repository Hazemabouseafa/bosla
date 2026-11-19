import { Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunityAccessService } from './community-access.service';
import {
  AdminCommunityController,
  CommunityController,
  InstructorCommunityController,
} from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [MembershipModule, NotificationsModule],
  controllers: [
    CommunityController,
    InstructorCommunityController,
    AdminCommunityController,
  ],
  providers: [CommunityAccessService, CommunityService],
  exports: [CommunityAccessService, CommunityService],
})
export class CommunityModule {}
