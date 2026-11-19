import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
  SkipCsrf,
} from '../../core/decorators';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from '../../core/guards';
import { REFERRAL_COOKIE_NAME } from '../sellers/sellers.service';
import { CommerceService } from './commerce.service';

@ApiTags('E-Commerce Cart, Coupons, Orders & Payments')
@Controller('commerce')
export class CommerceController {
  constructor(@Inject(CommerceService) private readonly commerce: CommerceService) {}

  // ---- Cart ----
  @Get('cart')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get authenticated student shopping cart & active seller prefill' })
  getCart(@CurrentUser() user: AuthenticatedContextUser, @Req() req: Request) {
    const token = req.cookies?.[REFERRAL_COOKIE_NAME] as string | undefined;
    return this.commerce.getCart(user.id, token);
  }

  @Post('cart/items')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Add a published course to cart' })
  addToCart(@CurrentUser() user: AuthenticatedContextUser, @Body() body: unknown) {
    return this.commerce.addToCart(user.id, body);
  }

  @Delete('cart/items/:courseId')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Remove a course from cart' })
  removeFromCart(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.commerce.removeFromCart(user.id, courseId);
  }

  @Delete('cart')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  clearCart(@CurrentUser() user: AuthenticatedContextUser) {
    return this.commerce.clearCart(user.id);
  }

  // ---- Checkout Preview & Orders ----
  @Post('orders/preview')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Preview multi-course order pricing, coupon discount, and seller attribution' })
  previewOrder(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const token = req.cookies?.[REFERRAL_COOKIE_NAME] as string | undefined;
    return this.commerce.previewOrder(user, body, token, req.ip);
  }

  @Post('orders')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Create a single- or multi-course order with optional coupon and seller code' })
  createOrder(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const token = req.cookies?.[REFERRAL_COOKIE_NAME] as string | undefined;
    return this.commerce.createOrder(user, body, token, req.ip);
  }

  @Post('orders/membership')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Create a classified MONTHLY_MEMBERSHIP or ANNUAL_MEMBERSHIP order (seller commissions disabled)' })
  createMembershipOrder(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { membershipPlanId: string; sellerCode?: string },
  ) {
    return this.commerce.createMembershipOrder(user, body);
  }

  @Get('orders/my')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List authenticated user orders, payments, and refunds' })
  listMyOrders(@CurrentUser() user: AuthenticatedContextUser) {
    return this.commerce.listMyOrders(user.id);
  }

  @Get('orders/:orderId/invoice')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get structured Arabic invoice/receipt for an order' })
  getInvoice(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('orderId') orderId: string,
  ) {
    return this.commerce.getOrderInvoice(user, orderId);
  }

  // ---- Sandbox Confirmation (Only enabled when PAYMOB_MODE=sandbox) ----
  @Post('orders/:orderNumber/sandbox-confirm')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Confirm a sandbox electronic checkout payment for local testing' })
  confirmSandboxPayment(
    @Param('orderNumber') orderNumber: string,
    @Body() body?: { amountEgp?: number; externalTxId?: string },
  ) {
    if ((process.env.PAYMOB_MODE || 'sandbox') !== 'sandbox') {
      throw new BadRequestException('التأكيد التجريبي غير متاح في وضع الإنتاج');
    }
    const txId = body?.externalTxId || `sbx-ord-${orderNumber}-${Date.now()}`;
    return this.commerce.settleExternalOrderPayment({
      orderNumber,
      externalTxId: txId,
      amountPiasters: body?.amountEgp ? Math.round(Number(body.amountEgp) * 100) : 999_999_999,
      paymentMethod: 'PAYMOB_CARD',
    });
  }

  // ---- Electronic Payment Gateway Webhook (Idempotent on externalTxId) ----
  @Post('webhooks/paymob')
  @SkipCsrf()
  @ApiOperation({ summary: 'Idempotent HMAC-verified payment webhook for multi-course orders' })
  handlePaymobWebhook(@Body() body: any, @Query('hmac') hmac?: string) {
    return this.commerce.handlePaymobOrderWebhook(body, hmac);
  }

  // ---- Admin / Finance Order Operations ----
  @Get('admin/orders')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('orders.read')
  adminListOrders(
    @Query('status') status?: string,
    @Query('accountingType') accountingType?: string,
    @Query('q') q?: string,
  ) {
    return this.commerce.adminListOrders({ status, accountingType, q });
  }

  @Post('admin/orders/:orderId/payments/manual')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('orders.manual_payment')
  @ApiOperation({ summary: 'Record full or partial manual / bank transfer / offline payment with sequential allocation' })
  recordManualPayment(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('orderId') orderId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.commerce.recordManualPayment(actor, orderId, body, req.ip);
  }

  @Post('admin/payments/:paymentId/allocations/override')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('payments.allocate_manual')
  @ApiOperation({ summary: 'Manually reallocate a payment across order items with mandatory audit reason' })
  overrideAllocation(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('paymentId') paymentId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.commerce.overridePaymentAllocation(actor, paymentId, body, req.ip);
  }

  @Post('admin/orders/:orderId/attribution/override')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('sellers.manage')
  @ApiOperation({ summary: 'Admin override of seller attribution before commission payout (audited)' })
  overrideAttribution(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('orderId') orderId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.commerce.overrideOrderAttribution(actor, orderId, body, req.ip);
  }

  // ---- Coupons ----
  @Get('admin/coupons')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('orders.read')
  listCoupons() {
    return this.commerce.listCoupons();
  }

  @Post('admin/coupons')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('courses.manage')
  createCoupon(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.commerce.createCoupon(actor, body, req.ip);
  }

  @Patch('admin/coupons/:couponId')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('courses.manage')
  toggleCoupon(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('couponId') couponId: string,
    @Body() body: { isActive: boolean },
    @Req() req: Request,
  ) {
    return this.commerce.toggleCoupon(actor, couponId, Boolean(body?.isActive), req.ip);
  }
}
