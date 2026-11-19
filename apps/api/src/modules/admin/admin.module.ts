import { Module } from '@nestjs/common';
import { VideoModule } from '../video/video.module';
import { AdminController } from './admin.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminService } from './admin.service';

@Module({
  imports: [VideoModule],
  controllers: [AdminController],
  providers: [AdminService, AdminOperationsService],
  exports: [AdminService, AdminOperationsService],
})
export class AdminModule {}
