import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedContextUser,
  CurrentUser,
  SkipCsrf,
} from '../../core/decorators';
import { CsrfGuard, SessionAuthGuard } from '../../core/guards';
import { MembershipService } from './membership.service';

@ApiTags('Memberships & Paymob Payments')
@Controller()
export class MembershipController {
  constructor(@Inject(MembershipService) private readonly membership: MembershipService) {}

  @Get('memberships/plans')
  @ApiOperation({ summary: 'List public active monthly and annual membership plans' })
  listPlans() {
    return this.membership.listPublicPlans();
  }

  @Get('memberships/me')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get authenticated student active subscription, entitlements, and transactions' })
  getMyMembership(@CurrentUser() user: AuthenticatedContextUser) {
    return this.membership.getMyMembershipSummary(user.id);
  }

  @Post('memberships/checkout')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Initialize Paymob checkout for monthly or annual membership' })
  initiateCheckout(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { planId: string },
  ) {
    return this.membership.initiateCheckout(user.id, body.planId);
  }

  @Get('memberships/transactions/:merchantOrderId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Verify backend transaction status (never trust browser query flags alone)' })
  getTransactionStatus(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('merchantOrderId') merchantOrderId: string,
  ) {
    return this.membership.getTransactionStatus(user.id, merchantOrderId);
  }

  @Post('memberships/subscriptions/:id/cancel')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Cancel subscription renewal / schedule end of period cancellation' })
  cancelSubscription(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('id') id: string,
  ) {
    return this.membership.cancelSubscription(user.id, id);
  }

  @Post('payments/paymob/webhook')
  @SkipCsrf()
  @ApiOperation({ summary: 'Authenticated & idempotent Paymob transaction webhook' })
  handlePaymobWebhook(
    @Body() payload: Record<string, any>,
    @Query('hmac') hmac?: string,
  ) {
    return this.membership.processPaymobWebhook(payload, hmac);
  }

  @Post('payments/paymob/sandbox-simulate')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Sandbox-only payment test trigger routed through HMAC webhook verification' })
  simulateSandbox(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { merchantOrderId: string; outcome: 'PAID' | 'FAILED' },
  ) {
    return this.membership.triggerSandboxOutcome(user.id, body.merchantOrderId, body.outcome);
  }
}
