import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { MembershipModule } from '../membership/membership.module';
import { SellersModule } from '../sellers/sellers.module';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';

@Module({
  imports: [SellersModule, FinanceModule, MembershipModule],
  controllers: [CommerceController],
  providers: [CommerceService],
  exports: [CommerceService],
})
export class CommerceModule {}
