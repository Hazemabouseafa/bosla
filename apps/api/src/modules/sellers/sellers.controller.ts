import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  AuthenticatedContextUser,
  CurrentUser,
  RequirePermissions,
  SkipCsrf,
} from '../../core/decorators';
import {
  CsrfGuard,
  OptionalSessionAuthGuard,
  RolesGuard,
  SessionAuthGuard,
} from '../../core/guards';
import { isRequestHttps } from '../../core/http-security.helper';
import { REFERRAL_COOKIE_NAME, SellersService } from './sellers.service';

@ApiTags('Sellers, Affiliate Portal & Referrals')
@Controller('sellers')
export class SellersController {
  constructor(@Inject(SellersService) private readonly sellers: SellersService) {}

  // Public Referral Visit Tracker (30-day HttpOnly cookie with opaque non-PII token)
  @Post('referrals/track')
  @SkipCsrf()
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Record server-side referral visit for a seller code (30 days, zero PII)' })
  async trackReferral(
    @CurrentUser() user: AuthenticatedContextUser | undefined,
    @Body() body: { code?: string; landingPath?: string; sourceTag?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.sellers.trackReferralVisit({
      rawCode: body?.code || '',
      userId: user?.id ?? null,
      landingPath: body?.landingPath,
      sourceTag: body?.sourceTag,
      ipAddress: req.ip,
    });

    if (result.valid) {
      res.cookie(REFERRAL_COOKIE_NAME, result.trackingToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isRequestHttps(req),
        maxAge: 30 * 86_400_000,
        path: '/',
      });
    }

    return result;
  }

  @Get('referrals/active')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Get active server-tracked seller code for checkout prefill' })
  async getActiveReferral(
    @CurrentUser() user: AuthenticatedContextUser | undefined,
    @Req() req: Request,
  ) {
    const token = req.cookies?.[REFERRAL_COOKIE_NAME] as string | undefined;
    const prefill = await this.sellers.resolvePrefillFromReferralToken(token, user?.id ?? null);
    return { prefill };
  }

  // Seller Application & Portal (strict own-data isolation)
  @Post('apply')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Submit or resubmit an individual seller application' })
  apply(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.sellers.applyAsSeller(user, body, req.ip);
  }

  @Get('portal')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get authenticated seller portal dashboard (strictly own data)' })
  getPortal(@CurrentUser() user: AuthenticatedContextUser) {
    return this.sellers.getSellerPortalOverview(user);
  }

  @Get('portal/payouts/:payoutId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get detailed monthly settlement statement for authenticated seller only' })
  getMyPayoutDetail(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('payoutId') payoutId: string,
  ) {
    return this.sellers.getSellerPayoutDetailForOwner(user, payoutId);
  }

  @Get('codes/:codeId/qr')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Generate SVG QR code and referral URL for a seller code' })
  getCodeQr(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('codeId') codeId: string,
  ) {
    return this.sellers.getCodeQrSvg(codeId, user);
  }

  // Admin / Academy Manager Seller Governance
  @Get('admin/list')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('sellers.manage')
  @ApiOperation({ summary: 'List seller profiles, applications, and codes' })
  adminList(@Query('status') status?: string, @Query('q') q?: string) {
    return this.sellers.adminListSellers(status, q);
  }

  @Post('admin/:sellerId/review')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('sellers.manage')
  @ApiOperation({ summary: 'Approve, reject, or request changes on a seller application' })
  adminReview(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('sellerId') sellerId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.sellers.adminReviewSellerApplication(actor, sellerId, body, req.ip);
  }

  @Patch('admin/:sellerId/status')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('sellers.manage')
  @ApiOperation({ summary: 'Suspend, reactivate, or update KYC/payout verification flags' })
  adminChangeStatus(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('sellerId') sellerId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.sellers.adminChangeSellerStatus(actor, sellerId, body, req.ip);
  }

  @Post('admin/:sellerId/codes')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('sellers.manage')
  @ApiOperation({ summary: 'Issue a normalized unique seller code with optional course restrictions' })
  createCode(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('sellerId') sellerId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.sellers.createSellerCode(actor, sellerId, body, req.ip);
  }

  @Patch('admin/codes/:codeId')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('sellers.manage')
  @ApiOperation({ summary: 'Enable or disable a seller code' })
  toggleCode(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('codeId') codeId: string,
    @Body() body: { isActive: boolean },
    @Req() req: Request,
  ) {
    return this.sellers.toggleSellerCode(actor, codeId, Boolean(body?.isActive), req.ip);
  }

  @Post('admin/materials')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('sellers.manage')
  @ApiOperation({ summary: 'Create marketing asset/copy for approved sellers' })
  createMaterial(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: any,
  ) {
    return this.sellers.createMarketingMaterial(actor, body);
  }
}
