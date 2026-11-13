import { Module } from '@nestjs/common';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { PaymobClient } from './paymob.client';

@Module({
  controllers: [MembershipController],
  providers: [MembershipService, PaymobClient],
  exports: [MembershipService, PaymobClient],
})
export class MembershipModule {}
