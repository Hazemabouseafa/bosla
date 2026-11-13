import { Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { MediaStorageService } from './media-storage.service';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

@Module({
  imports: [MembershipModule],
  controllers: [VideoController],
  providers: [MediaStorageService, VideoService],
  exports: [MediaStorageService, VideoService],
})
export class VideoModule {}
