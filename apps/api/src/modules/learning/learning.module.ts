import { Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { VideoModule } from '../video/video.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({
  imports: [MembershipModule, VideoModule],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
