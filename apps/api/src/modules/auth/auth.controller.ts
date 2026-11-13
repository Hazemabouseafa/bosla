import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  AllowPendingEnrollment,
  AuthenticatedContextUser,
  CurrentUser,
  SkipCsrf,
} from '../../core/decorators';
import {
  CsrfGuard,
  SESSION_COOKIE_NAME,
  SessionAuthGuard,
} from '../../core/guards';
import { AuthService } from './auth.service';

@ApiTags('Authentication, WebAuthn Passkeys & Non-OTP Recovery')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  private setSessionCookie(
    req: Request,
    res: Response,
    rawToken: string,
    expiresAt: Date,
  ) {
    const isHttps =
      process.env.COOKIE_SECURE === 'true' ||
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https';

    res.cookie(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: Boolean(isHttps),
      expires: expiresAt,
      path: '/',
    });
  }

  private clearSessionCookie(req: Request, res: Response) {
    const isHttps =
      process.env.COOKIE_SECURE === 'true' ||
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: Boolean(isHttps),
      path: '/',
    });
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @AllowPendingEnrollment()
  @ApiOperation({ summary: 'Get authenticated session user details and CSRF token' })
  async getMe(@CurrentUser() user: AuthenticatedContextUser) {
    const profile = await this.authService.getSessionUserDetails(user.id);
    return {
      user: profile,
      csrfToken: user.csrfSecret,
      requiresPasskeyEnrollment: profile.status === 'ENROLLMENT_PENDING',
      lastRecentAuthAt: user.lastRecentAuthAt,
    };
  }

  @Post('google')
  @SkipCsrf()
  @ApiOperation({ summary: 'Option A: Authenticate or auto-create student account via Google OIDC (no OTP/password)' })
  async googleAuth(
    @Body() body: { credential: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.authenticateWithGoogle(
      body,
      req.ip,
      req.headers['user-agent'],
    );
    this.setSessionCookie(req, res, result.rawToken, result.expiresAt);
    return {
      user: result.user,
      csrfToken: result.csrfSecret,
      isNewAccount: result.isNewAccount,
      requiresPasskeyEnrollment: result.requiresPasskeyEnrollment,
    };
  }

  @Post('register/phone')
  @SkipCsrf()
  @ApiOperation({ summary: 'Option B: Register student with mobile (E.164) + Argon2id password in ENROLLMENT_PENDING state (NO OTP)' })
  async registerPhone(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerWithPhone(
      body,
      req.ip,
      req.headers['user-agent'],
    );
    this.setSessionCookie(req, res, result.rawToken, result.expiresAt);
    return {
      user: result.user,
      csrfToken: result.csrfSecret,
      requiresPasskeyEnrollment: result.requiresPasskeyEnrollment,
    };
  }

  @Post('login/phone')
  @SkipCsrf()
  @ApiOperation({ summary: 'Log in with registered mobile number and password' })
  async loginPhone(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithPhone(
      body,
      req.ip,
      req.headers['user-agent'],
    );
    this.setSessionCookie(req, res, result.rawToken, result.expiresAt);
    return {
      user: result.user,
      csrfToken: result.csrfSecret,
      requiresPasskeyEnrollment: result.requiresPasskeyEnrollment,
    };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @AllowPendingEnrollment()
  @ApiOperation({ summary: 'Revoke current session and clear httpOnly session cookie' })
  async logout(
    @CurrentUser() user: AuthenticatedContextUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.revokeSession(user.sessionId, user.id, req.ip);
    this.clearSessionCookie(req, res);
    return { loggedOut: true };
  }

  // ============================================================
  // WEBAUTHN PASSKEYS (ENROLLMENT + LOGIN + ACCOUNT MANAGEMENT)
  // ============================================================

  @Post('passkeys/register/options')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @AllowPendingEnrollment()
  @ApiOperation({ summary: 'Generate WebAuthn registration options for mandatory enrollment or additional Passkey' })
  startPasskeyRegistration(
    @CurrentUser() user: AuthenticatedContextUser,
    @Headers('origin') originHeader: string | undefined,
  ) {
    return this.authService.startPasskeyRegistration(user.id, originHeader);
  }

  @Post('passkeys/register/verify')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @AllowPendingEnrollment()
  @ApiOperation({ summary: 'Verify WebAuthn registration, activate account if pending, and return one-time recovery codes' })
  verifyPasskeyRegistration(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { response: any; friendlyName?: string },
    @Headers('origin') originHeader: string | undefined,
    @Req() req: Request,
  ) {
    return this.authService.verifyPasskeyRegistration({
      userId: user.id,
      sessionId: user.sessionId,
      response: body.response,
      friendlyName: body.friendlyName,
      requestOrigin: originHeader,
      ip: req.ip,
    });
  }

  @Post('passkeys/login/options')
  @SkipCsrf()
  @ApiOperation({ summary: 'Start WebAuthn authentication challenge for Passkey login' })
  startPasskeyLogin(
    @Body() body: { countryCode?: string; phoneNumber?: string },
    @Headers('origin') originHeader: string | undefined,
  ) {
    return this.authService.startPasskeyLogin(body, originHeader);
  }

  @Post('passkeys/login/verify')
  @SkipCsrf()
  @ApiOperation({ summary: 'Verify WebAuthn assertion and create authenticated session' })
  async verifyPasskeyLogin(
    @Body() body: { response: any },
    @Headers('origin') originHeader: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyPasskeyLogin(
      body.response,
      originHeader,
      req.ip,
      req.headers['user-agent'],
    );
    this.setSessionCookie(req, res, result.rawToken, result.expiresAt);
    return {
      user: result.user,
      csrfToken: result.csrfSecret,
      requiresPasskeyEnrollment: false,
    };
  }

  @Get('passkeys')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List registered WebAuthn Passkeys for current account' })
  listPasskeys(@CurrentUser() user: AuthenticatedContextUser) {
    return this.authService.listUserPasskeys(user.id);
  }

  @Delete('passkeys/:passkeyId')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Delete a Passkey after recent secure reauthentication' })
  deletePasskey(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('passkeyId') passkeyId: string,
    @Req() req: Request,
  ) {
    return this.authService.deleteUserPasskey(user.id, user.sessionId, passkeyId, req.ip);
  }

  // ============================================================
  // REAUTHENTICATION & RECOVERY CODE REGENERATION
  // ============================================================

  @Post('reauth/password')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Confirm password to unlock sensitive account/Passkey settings' })
  reauthPassword(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { password: string },
  ) {
    return this.authService.reauthWithPassword(user.id, user.sessionId, body.password);
  }

  @Post('reauth/passkey/options')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Start Passkey reauthentication challenge' })
  reauthPasskeyOptions(
    @CurrentUser() user: AuthenticatedContextUser,
    @Headers('origin') originHeader: string | undefined,
  ) {
    return this.authService.startReauthPasskey(user.id, originHeader);
  }

  @Post('reauth/passkey/verify')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Verify Passkey reauthentication challenge' })
  reauthPasskeyVerify(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { response: any },
    @Headers('origin') originHeader: string | undefined,
  ) {
    return this.authService.verifyReauthPasskey(
      user.id,
      user.sessionId,
      body.response,
      originHeader,
    );
  }

  @Post('recovery-codes/regenerate')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Regenerate 10 single-use backup recovery codes after recent reauthentication' })
  regenerateRecoveryCodes(
    @CurrentUser() user: AuthenticatedContextUser,
    @Req() req: Request,
  ) {
    return this.authService.regenerateRecoveryCodes(user.id, user.sessionId, req.ip);
  }

  @Post('google/link')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Explicitly link Google identity after recent reauthentication' })
  linkGoogle(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { credential: string },
    @Req() req: Request,
  ) {
    return this.authService.linkGoogleToAuthenticatedAccount(
      user.id,
      user.sessionId,
      body,
      req.ip,
    );
  }

  @Patch('profile')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Update profile details (fullName, optional email, headline, bio)' })
  updateProfile(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { fullName?: string; email?: string | null; headlineAr?: string | null; bioAr?: string | null },
  ) {
    return this.authService.updateProfile(user.id, body);
  }

  // ============================================================
  // NON-OTP PASSWORD RECOVERY FLOWS
  // ============================================================

  @Post('recovery/identify')
  @SkipCsrf()
  @ApiOperation({ summary: 'Identify recovery options by registered mobile number (NO OTP)' })
  identifyRecovery(@Body() body: unknown, @Req() req: Request) {
    return this.authService.identifyRecoveryAccount(body, req.ip);
  }

  @Post('recovery/passkey/options')
  @SkipCsrf()
  @ApiOperation({ summary: 'Method A: Start Passkey challenge for non-OTP password recovery' })
  recoveryPasskeyOptions(
    @Body() body: unknown,
    @Headers('origin') originHeader: string | undefined,
  ) {
    return this.authService.startRecoveryPasskeyChallenge(body, originHeader);
  }

  @Post('recovery/passkey/verify')
  @SkipCsrf()
  @ApiOperation({ summary: 'Method A: Verify Passkey assertion and issue single-use password reset token' })
  recoveryPasskeyVerify(
    @Body() body: { countryCode?: string; phoneNumber: string; response: any },
    @Headers('origin') originHeader: string | undefined,
    @Req() req: Request,
  ) {
    return this.authService.verifyRecoveryPasskeyAssertion({
      countryCode: body.countryCode || '+20',
      phoneNumber: body.phoneNumber,
      response: body.response,
      requestOrigin: originHeader,
      ip: req.ip,
    });
  }

  @Post('recovery/code/verify')
  @SkipCsrf()
  @ApiOperation({ summary: 'Method B: Consume single-use hashed recovery code atomically and issue password reset token' })
  recoveryCodeVerify(@Body() body: unknown, @Req() req: Request) {
    return this.authService.verifyRecoveryCode(body, req.ip);
  }

  @Post('recovery/reset-password')
  @SkipCsrf()
  @ApiOperation({ summary: 'Complete password reset using verified single-use reset token and revoke all sessions' })
  resetPassword(@Body() body: unknown, @Req() req: Request) {
    return this.authService.confirmPasswordReset(body, req.ip);
  }

  @Post('recovery/support-request')
  @SkipCsrf()
  @ApiOperation({ summary: 'Method C: Submit support-assisted recovery request when Passkey and recovery codes are unavailable' })
  submitSupportRequest(@Body() body: unknown, @Req() req: Request) {
    return this.authService.submitSupportRecoveryRequest(body, req.ip);
  }
}
