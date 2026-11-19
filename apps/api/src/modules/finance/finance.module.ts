import { Module } from '@nestjs/common';
import { CommissionEngineService } from './commission-engine.service';
import { CommissionRulesService } from './commission-rules.service';
import { FinanceController } from './finance.controller';
import { RefundSettlementService } from './refund-settlement.service';

@Module({
  controllers: [FinanceController],
  providers: [CommissionRulesService, CommissionEngineService, RefundSettlementService],
  exports: [CommissionRulesService, CommissionEngineService, RefundSettlementService],
})
export class FinanceModule {}
