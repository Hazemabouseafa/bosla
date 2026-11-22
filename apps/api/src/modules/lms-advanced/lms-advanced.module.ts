import { Module } from '@nestjs/common';
import { MembershipModule } from '../membership/membership.module';
import { LmsAdvancedController } from './lms-advanced.controller';
import { LmsAdvancedService } from './lms-advanced.service';

@Module({
  imports: [MembershipModule],
  controllers: [LmsAdvancedController],
  providers: [LmsAdvancedService],
  exports: [LmsAdvancedService],
})
export class LmsAdvancedModule {}
