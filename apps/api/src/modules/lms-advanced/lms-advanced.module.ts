import { Module } from '@nestjs/common';
import { LmsAdvancedController } from './lms-advanced.controller';
import { LmsAdvancedService } from './lms-advanced.service';

@Module({
  controllers: [LmsAdvancedController],
  providers: [LmsAdvancedService],
  exports: [LmsAdvancedService],
})
export class LmsAdvancedModule {}
