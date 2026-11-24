import { Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { MediaStorageService } from './media-storage.service';
import { VideoCaptionsAndAnalyticsService } from './video-captions-analytics.service';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

@Module({
  imports: [MembershipModule],
  controllers: [VideoController],
  providers: [MediaStorageService, VideoService, VideoCaptionsAndAnalyticsService],
  exports: [MediaStorageService, VideoService, VideoCaptionsAndAnalyticsService],
})
export class VideoModule {}
