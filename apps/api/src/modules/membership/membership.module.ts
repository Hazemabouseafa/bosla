import { Module } from '@nestjs/common';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { PAYMENT_GATEWAY_PROVIDER } from './payment-gateway.interface';
import { PaymobClient } from './paymob.client';

@Module({
  controllers: [MembershipController],
  providers: [
    MembershipService,
    PaymobClient,
    {
      provide: PAYMENT_GATEWAY_PROVIDER,
      useExisting: PaymobClient,
    },
  ],
  exports: [MembershipService, PaymobClient, PAYMENT_GATEWAY_PROVIDER],
})
export class MembershipModule {}
