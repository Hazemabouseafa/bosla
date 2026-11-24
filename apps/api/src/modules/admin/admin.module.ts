import { Module } from '@nestjs/common';
import { VideoModule } from '../video/video.module';
import { AdminController } from './admin.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminService } from './admin.service';
import { LiveEditorAndPaymobService } from './live-editor-paymob.service';

@Module({
  imports: [VideoModule],
  controllers: [AdminController],
  providers: [AdminService, AdminOperationsService, LiveEditorAndPaymobService],
  exports: [AdminService, AdminOperationsService, LiveEditorAndPaymobService],
})
export class AdminModule {}
