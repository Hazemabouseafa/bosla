import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  AuthenticatedContextUser,
  CurrentUser,
  RequirePermissions,
} from '../../core/decorators';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from '../../core/guards';
import { CommissionEngineService } from './commission-engine.service';
import { CommissionRulesService } from './commission-rules.service';
import { RefundSettlementService } from './refund-settlement.service';

@ApiTags('Enterprise Finance, Commissions, Settlements & Reconciliation')
@Controller('finance')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
export class FinanceController {
  constructor(
    @Inject(CommissionRulesService) private readonly rules: CommissionRulesService,
    @Inject(CommissionEngineService) private readonly engine: CommissionEngineService,
    @Inject(RefundSettlementService) private readonly settlement: RefundSettlementService,
  ) {}

  // ---- Commission Rules ----
  @Get('commission-rules')
  @RequirePermissions('commissions.rules.manage')
  @ApiOperation({ summary: 'List seller+course and course-default commission rules' })
  listRules(
    @Query('courseId') courseId?: string,
    @Query('sellerId') sellerId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.rules.listRules({ courseId, sellerId, activeOnly: activeOnly === 'true' });
  }

  @Post('commission-rules')
  @RequirePermissions('commissions.rules.manage')
  @ApiOperation({ summary: 'Create non-overlapping fixed-amount commission rule with configurable cap' })
  createRule(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.rules.createRule(actor, body, req.ip);
  }

  @Patch('commission-rules/:ruleId/deactivate')
  @RequirePermissions('commissions.rules.manage')
  @ApiOperation({ summary: 'Deactivate an active commission rule' })
  deactivateRule(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('ruleId') ruleId: string,
    @Req() req: Request,
  ) {
    return this.rules.deactivateRule(actor, ruleId, req.ip);
  }

  // ---- Commissions & Hourly Hold Maturation ----
  @Get('commissions')
  @RequirePermissions('finance.dashboard.read')
  @ApiOperation({ summary: 'List seller commissions across all lifecycle statuses' })
  listCommissions(
    @Query('status') status?: string,
    @Query('sellerId') sellerId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.settlement.listCommissions({ status, sellerId, courseId });
  }

  @Post('commissions/:commissionId/review')
  @RequirePermissions('commissions.approve')
  @ApiOperation({ summary: 'Approve, dispute, resolve, or reverse a commission' })
  reviewCommission(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('commissionId') commissionId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.settlement.reviewCommission(actor, commissionId, body, req.ip);
  }

  @Post('commissions/bulk-approve')
  @RequirePermissions('commissions.approve')
  @ApiOperation({ summary: 'Bulk approve ELIGIBLE seller commissions' })
  bulkApprove(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.settlement.bulkApproveCommissions(actor, body, req.ip);
  }

  @Post('jobs/mature-commissions')
  @RequirePermissions('commissions.approve')
  @ApiOperation({ summary: 'Run hourly 14-day Cairo hold maturation check immediately' })
  runMaturation(@Body() body?: { asOfUtc?: string }) {
    const asOf = body?.asOfUtc ? new Date(body.asOfUtc) : new Date();
    return this.engine.runHourlyEligibilityMaturation(asOf);
  }

  // ---- Refunds & Chargebacks ----
  @Post('refunds')
  @RequirePermissions('orders.refund')
  @ApiOperation({ summary: 'Process full/partial refund or chargeback with automatic commission reversal' })
  processRefund(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.settlement.processRefund(actor, body, req.ip);
  }

  // ---- Maker-Checker Settlements & Payouts ----
  @Get('settlements')
  @RequirePermissions('finance.dashboard.read')
  @ApiOperation({ summary: 'List monthly seller settlement statements' })
  listSettlements(@Query('sellerId') sellerId?: string, @Query('status') status?: string) {
    return this.settlement.listSettlements({ sellerId, status });
  }

  @Post('settlements')
  @RequirePermissions('settlements.create')
  @ApiOperation({ summary: 'Maker: generate monthly seller settlement up to 23:59:59 Africa/Cairo' })
  createSettlement(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.settlement.createMonthlySettlement(actor, body, req.ip);
  }

  @Post('settlements/:payoutId/approve')
  @RequirePermissions('settlements.approve')
  @ApiOperation({ summary: 'Checker: approve a DRAFT settlement (strict Maker !== Checker)' })
  approveSettlement(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('payoutId') payoutId: string,
    @Req() req: Request,
  ) {
    return this.settlement.approveSettlement(actor, payoutId, req.ip);
  }

  @Post('settlements/:payoutId/pay')
  @RequirePermissions('settlements.payout')
  @ApiOperation({ summary: 'Execute bank/wallet payout on an APPROVED settlement with transfer reference' })
  markPaid(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('payoutId') payoutId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.settlement.markSettlementPaid(actor, payoutId, body, req.ip);
  }

  @Post('settlements/:payoutId/fail')
  @RequirePermissions('settlements.payout')
  @ApiOperation({ summary: 'Mark an APPROVED settlement as FAILED and allow one retry of APPROVED commissions' })
  markFailed(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('payoutId') payoutId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.settlement.markSettlementFailed(actor, payoutId, body, req.ip);
  }

  // ---- Adjustments, Expenses, Period Closing, Dashboard & Reconciliation ----
  @Post('adjustments')
  @RequirePermissions('finance.expenses.manage')
  @ApiOperation({ summary: 'Record an immutable financial adjustment (no edits or deletes)' })
  createAdjustment(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.settlement.createFinancialAdjustment(actor, body, req.ip);
  }

  @Get('expenses')
  @RequirePermissions('finance.dashboard.read')
  listExpenses() {
    return this.settlement.listExpenses();
  }

  @Post('expenses')
  @RequirePermissions('finance.expenses.manage')
  recordExpense(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.settlement.recordExpense(actor, body, req.ip);
  }

  @Post('periods/close')
  @RequirePermissions('finance.period.close')
  @ApiOperation({ summary: 'Close a monthly accounting period and freeze historical edits' })
  closePeriod(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.settlement.closeAccountingPeriod(actor, body, req.ip);
  }

  @Get('dashboard')
  @RequirePermissions('finance.dashboard.read')
  @ApiOperation({ summary: 'Get P&L, cash flow, recognition vs cash collection, and financial KPIs' })
  getDashboard() {
    return this.settlement.getFinanceDashboard();
  }

  @Get('sellers-directory')
  @RequirePermissions('finance.dashboard.read')
  @ApiOperation({ summary: 'Read-only directory of sellers for finance officers creating settlements or rules' })
  listSellersDirectory() {
    return this.settlement.listSellersDirectory();
  }

  @Get('reconciliation')
  @RequirePermissions('finance.reconcile')
  @ApiOperation({ summary: 'Run full automated accounting reconciliation across orders, payments, allocations, commissions, and payouts' })
  runReconciliation() {
    return this.settlement.runReconciliationReport();
  }

  @Get('export/:dataset')
  @RequirePermissions('finance.reconcile')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export Arabic-compatible UTF-8 CSV reports (orders | commissions | payouts | reconciliation)' })
  exportCsv(@Param('dataset') dataset: 'orders' | 'commissions' | 'payouts' | 'reconciliation') {
    const valid = ['orders', 'commissions', 'payouts', 'reconciliation'];
    const target = valid.includes(dataset) ? dataset : 'reconciliation';
    return this.settlement.exportCsv(target);
  }
}
