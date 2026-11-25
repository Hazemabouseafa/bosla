import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { User } from '@bosla/db';
import {
  emailRecoveryConfirmSchema,
  emailRecoveryRequestSchema,
  emailVerifyConfirmSchema,
  emailVerifyRequestSchema,
  googleAuthSchema,
  normalizePhoneToE164,
  phoneLoginSchema,
  phoneRegisterSchema,
  recoveryIdentifySchema,
  recoveryWithCodeSchema,
  resetPasswordConfirmSchema,
  supportRecoverySchema,
  updateProfileSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import { hashSessionToken } from '../../core/guards';
import { PrismaService } from '../../core/prisma.service';
import { resolveUserAccess } from '../../core/rbac-resolver';
import { RedisService } from '../../core/redis.service';
import { IntegrationsMailService } from '../integrations-mail/integrations-mail.service';

const SESSION_TTL_DAYS = 14;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const REAUTH_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(IntegrationsMailService)
    private readonly mailIntegrations: IntegrationsMailService,
  ) {}

  private getWebAuthnConfig(requestOrigin?: string) {
    const rpName = process.env.WEBAUTHN_RP_NAME || 'BOSLA Academy';
    const configuredRpId = process.env.WEBAUTHN_RP_ID || 'localhost';
    const configuredOrigins = (
      process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let effectiveOrigin = configuredOrigins[0] || 'http://localhost:3000';
    if (requestOrigin && configuredOrigins.includes(requestOrigin)) {
      effectiveOrigin = requestOrigin;
    }

    let rpId = configuredRpId;
    if (requestOrigin && rpId === 'localhost') {
      try {
        const hostname = new URL(requestOrigin).hostname;
        if (hostname === '127.0.0.1' || hostname === 'localhost') {
          rpId = hostname;
        }
      } catch {
        // Ignore invalid origin header
      }
    }

    return { rpName, rpId, expectedOrigins: configuredOrigins, effectiveOrigin };
  }

  private hashRecoveryCode(userId: string, rawCode: string): string {
    const normalized = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const pepper =
      process.env.RECOVERY_CODE_PEPPER ||
      process.env.SESSION_SECRET ||
      'dev_only_replace_with_64_char_random_secret_for_sessions';
    return createHmac('sha256', pepper)
      .update(`${userId}:${normalized}`)
      .digest('hex');
  }

  private generateRecoveryCodeSet(count = 10): string[] {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codes: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const bytes = randomBytes(16);
      let raw = '';
      for (let j = 0; j < 16; j += 1) {
        raw += alphabet[bytes[j]! % alphabet.length];
      }
      codes.push(
        `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`,
      );
    }
    return codes;
  }

  private async issueRecoveryCodesForUser(userId: string): Promise<string[]> {
    const plainCodes = this.generateRecoveryCodeSet(10);
    await this.prisma.$transaction(async (tx) => {
      await tx.recoveryCode.deleteMany({ where: { userId } });
      await tx.recoveryCode.createMany({
        data: plainCodes.map((code) => ({
          userId,
          codeHash: this.hashRecoveryCode(userId, code),
        })),
      });
    });
    return plainCodes;
  }

  async createSessionForUser(params: {
    user: Pick<User, 'id' | 'role' | 'status' | 'fullName' | 'email' | 'phoneE164' | 'authProvider'>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashSessionToken(rawToken);
    const csrfSecret = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: params.user.id,
        tokenHash,
        csrfSecret,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        lastRecentAuthAt: new Date(),
        expiresAt,
      },
    });

    return {
      rawToken,
      session,
      expiresAt,
      user: {
        id: params.user.id,
        fullName: params.user.fullName,
        email: params.user.email,
        phoneE164: params.user.phoneE164,
        role: params.user.role,
        status: params.user.status,
        authProvider: params.user.authProvider,
      },
      csrfSecret,
    };
  }

  async revokeSession(sessionId: string, userId: string, ip?: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId: userId,
      action: 'USER_LOGOUT',
      entityType: 'Session',
      entityId: sessionId,
      ipAddress: ip,
    });
  }

  async getSessionUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        emailVerifiedAt: true,
        phoneE164: true,
        googleSub: true,
        role: true,
        status: true,
        authProvider: true,
        avatarUrl: true,
        headlineAr: true,
        bioAr: true,
        createdAt: true,
        _count: {
          select: {
            passkeys: true,
            recoveryCodes: { where: { usedAt: null } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    const access = await resolveUserAccess(this.prisma, user.id, user.role);
    return {
      ...user,
      roles: access.roles,
      permissions: access.permissions,
      sellerId: access.sellerId,
      organizationIds: access.organizationIds,
      hasGoogleLinked: Boolean(user.googleSub),
      passkeyCount: user._count.passkeys,
      unusedRecoveryCodesCount: user._count.recoveryCodes,
      googleSub: undefined,
      _count: undefined,
    };
  }

  // ============================================================
  // OPTION A: GOOGLE OIDC AUTHENTICATION (DYNAMIC RUNTIME CONFIG)
  // ============================================================

  async getAuthCapabilities() {
    return this.mailIntegrations.getPublicAuthCapabilities();
  }

  private getOAuthStateSecret(): string {
    return (
      process.env.SESSION_SECRET ||
      process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY ||
      'bosla-oauth-state-secret-2026'
    );
  }

  private signGoogleOAuthState(nextPath: string): string {
    const payload = Buffer.from(
      JSON.stringify({
        nonce: randomBytes(16).toString('base64url'),
        nextPath: nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/student',
        exp: Date.now() + 10 * 60 * 1000,
      }),
      'utf8',
    ).toString('base64url');
    const sig = createHmac('sha256', this.getOAuthStateSecret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyGoogleOAuthState(state: string): { nextPath: string } {
    const parts = (state || '').split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('رمز التحقق من الجلسة (state) غير صالح');
    }
    const [payloadB64, sig] = parts;
    const expected = createHmac('sha256', this.getOAuthStateSecret())
      .update(payloadB64!)
      .digest('base64url');
    if (
      sig!.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig!), Buffer.from(expected))
    ) {
      throw new UnauthorizedException('توقيع حالة مصادقة جوجل غير صالح');
    }
    const decoded = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf8'));
    if (!decoded?.exp || Date.now() > Number(decoded.exp)) {
      throw new UnauthorizedException('انتهت صلاحية طلب تسجيل الدخول بجوجل، يرجى المحاولة مجدداً');
    }
    const nextPath =
      typeof decoded.nextPath === 'string' &&
      decoded.nextPath.startsWith('/') &&
      !decoded.nextPath.startsWith('//')
        ? decoded.nextPath
        : '/student';
    return { nextPath };
  }

  async startGoogleOAuthRedirect(requestOrigin?: string, nextPath = '/student') {
    const cfg = await this.mailIntegrations.resolveGoogleConfig();
    if (!cfg.isEnabled || !cfg.clientId || !cfg.clientSecret) {
      throw new BadRequestException(
        'تسجيل الدخول عبر Google Redirect غير مفعّل أو يفتقد Client ID / Client Secret في إعدادات المنصة',
      );
    }
    const adminInfo = await this.mailIntegrations.getGoogleConfigForAdmin(requestOrigin);
    const client = new OAuth2Client(cfg.clientId, cfg.clientSecret, adminInfo.callbackUrl);
    const state = this.signGoogleOAuthState(nextPath);
    const url = client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
    return { url };
  }

  async handleGoogleOAuthCallback(params: {
    code?: string;
    state?: string;
    requestOrigin?: string;
    ip?: string;
    ua?: string;
  }) {
    if (!params.code || !params.state) {
      throw new BadRequestException('بيانات الاستجابة من جوجل غير مكتملة');
    }
    const { nextPath } = this.verifyGoogleOAuthState(params.state);
    const cfg = await this.mailIntegrations.resolveGoogleConfig();
    if (!cfg.isEnabled || !cfg.clientId || !cfg.clientSecret) {
      throw new BadRequestException('تكامل جوجل غير مكتمل أو معطّل حالياً');
    }
    const adminInfo = await this.mailIntegrations.getGoogleConfigForAdmin(params.requestOrigin);
    const client = new OAuth2Client(cfg.clientId, cfg.clientSecret, adminInfo.callbackUrl);
    const { tokens } = await client.getToken(params.code);
    if (!tokens.id_token) {
      throw new UnauthorizedException('لم يُرجع جوجل رمز الهوية المطلوب (id_token)');
    }
    const authResult = await this.authenticateWithGoogle(
      { credential: tokens.id_token },
      params.ip,
      params.ua,
    );
    return { ...authResult, nextPath };
  }

  private async verifyGoogleCredential(credential: string): Promise<{
    sub: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    picture?: string;
  }> {
    // Test-only signed token format for automated offline test suites
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.ALLOW_TEST_GOOGLE_TOKENS === 'true' &&
      credential.startsWith('bosla-test-google.')
    ) {
      const parts = credential.split('.');
      if (parts.length !== 3) {
        throw new UnauthorizedException('رمز اختبار جوجل غير صالح');
      }
      const [, payloadB64, sig] = parts;
      const secret = process.env.SESSION_SECRET || 'bosla_test_google_secret';
      const expected = createHmac('sha256', secret).update(payloadB64!).digest('base64url');
      if (
        sig!.length !== expected.length ||
        !timingSafeEqual(Buffer.from(sig!), Buffer.from(expected))
      ) {
        throw new UnauthorizedException('توقيع اختبار جوجل غير صالح');
      }
      const decoded = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf8'));
      if (!decoded?.sub) {
        throw new UnauthorizedException('معرف Google sub مفقود');
      }
      return {
        sub: String(decoded.sub),
        email: typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : undefined,
        emailVerified: decoded.emailVerified === true || decoded.email_verified === true,
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
        picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
      };
    }

    const cfg = await this.mailIntegrations.resolveGoogleConfig();
    if (!cfg.isEnabled || !cfg.clientId) {
      throw new BadRequestException('تسجيل الدخول عبر Google غير مفعّل حالياً');
    }

    const client = new OAuth2Client(cfg.clientId, cfg.clientSecret || undefined);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: cfg.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new UnauthorizedException('تعذر التحقق من هوية جوجل');
    }

    return {
      sub: payload.sub,
      email: payload.email?.trim().toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name,
      picture: payload.picture,
    };
  }

  async authenticateWithGoogle(rawInput: { credential: string }, ip?: string, ua?: string) {
    const { credential } = googleAuthSchema.parse(rawInput);
    const googleUser = await this.verifyGoogleCredential(credential);

    if (!googleUser.email || googleUser.emailVerified !== true) {
      throw new UnauthorizedException(
        'يجب أن يحتوي حساب جوجل على بريد إلكتروني موثّق ومؤكد (email_verified) لإتمام الدخول',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { googleSub: googleUser.sub },
    });

    let isNewAccount = false;
    if (!user) {
      // Never auto-merge into an existing account silently without explicit authenticated linking
      const emailOwner = await this.prisma.user.findUnique({
        where: { email: googleUser.email },
      });
      if (emailOwner && emailOwner.googleSub !== googleUser.sub) {
        throw new ConflictException(
          'يوجد حساب مسجل مسبقاً بهذا البريد الإلكتروني. قم بتسجيل الدخول أولاً ثم اربط حساب جوجل من إعدادات الأمان.',
        );
      }

      user = await this.prisma.user.create({
        data: {
          fullName: googleUser.name || 'متعلم أكاديمية بوصلة',
          email: googleUser.email,
          emailVerifiedAt: new Date(),
          googleSub: googleUser.sub,
          avatarUrl: googleUser.picture ?? null,
          role: 'STUDENT',
          status: 'ACTIVE',
          authProvider: 'GOOGLE',
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
        },
      });
      isNewAccount = true;

      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'GOOGLE_REGISTER_STUDENT',
        entityType: 'User',
        entityId: user.id,
        ipAddress: ip,
      });
    } else {
      if (user.status === 'SUSPENDED') {
        throw new ForbiddenException('تم إيقاف هذا الحساب مؤقتاً من قبل الإدارة');
      }
      if (!user.emailVerifiedAt && user.email?.toLowerCase() === googleUser.email) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'GOOGLE_LOGIN',
        entityType: 'User',
        entityId: user.id,
        ipAddress: ip,
      });
    }

    const sessionResult = await this.createSessionForUser({
      user,
      ipAddress: ip,
      userAgent: ua,
    });

    return {
      isNewAccount,
      requiresPasskeyEnrollment: false,
      ...sessionResult,
    };
  }

  async linkGoogleToAuthenticatedAccount(
    userId: string,
    sessionId: string,
    rawInput: { credential: string },
    ip?: string,
  ) {
    await this.assertRecentReauthentication(sessionId);
    const { credential } = googleAuthSchema.parse(rawInput);
    const googleUser = await this.verifyGoogleCredential(credential);

    if (!googleUser.email || googleUser.emailVerified !== true) {
      throw new UnauthorizedException('يجب أن يكون البريد الإلكتروني في حساب جوجل موثّقاً قبل ربطه بالحساب');
    }

    const existingGoogleOwner = await this.prisma.user.findUnique({
      where: { googleSub: googleUser.sub },
    });
    if (existingGoogleOwner && existingGoogleOwner.id !== userId) {
      throw new ConflictException('حساب جوجل هذا مرتبط بحساب آخر بالفعل');
    }

    const emailOwner = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });
    if (emailOwner && emailOwner.id !== userId) {
      throw new ConflictException('هذا البريد الإلكتروني مرتبط بحساب آخر بالفعل');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleSub: googleUser.sub,
        email: googleUser.email,
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true, emailVerifiedAt: true, fullName: true },
    });

    await this.audit.log({
      actorId: userId,
      action: 'GOOGLE_ACCOUNT_LINKED',
      entityType: 'User',
      entityId: userId,
      ipAddress: ip,
    });

    return { linked: true, user: updated };
  }

  // ============================================================
  // OPTION B: PHONE + ARGON2ID PASSWORD REGISTRATION & LOGIN (NO OTP)
  // ============================================================

  async registerWithPhone(rawInput: unknown, ip?: string, ua?: string) {
    const parsed = phoneRegisterSchema.parse(rawInput);
    const phoneE164 = normalizePhoneToE164(parsed.phoneNumber, parsed.countryCode);
    if (!phoneE164) {
      throw new BadRequestException('أدخل رقم موبايل صحيحاً');
    }

    const existing = await this.prisma.user.findUnique({ where: { phoneE164 } });
    if (existing) {
      throw new ConflictException('رقم الموبايل مسجل بالفعل في أكاديمية بوصلة');
    }

    const passwordHash = await argon2.hash(parsed.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const user = await this.prisma.user.create({
      data: {
        fullName: parsed.fullName,
        phoneE164,
        passwordHash,
        role: 'STUDENT',
        status: 'ENROLLMENT_PENDING',
        authProvider: 'PHONE_PASSWORD',
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PHONE_REGISTER_PENDING_PASSKEY',
      entityType: 'User',
      entityId: user.id,
      metadata: { phoneE164 },
      ipAddress: ip,
    });

    const sessionResult = await this.createSessionForUser({
      user,
      ipAddress: ip,
      userAgent: ua,
    });

    return {
      requiresPasskeyEnrollment: true,
      ...sessionResult,
    };
  }

  async loginWithPhone(rawInput: unknown, ip?: string, ua?: string) {
    const parsed = phoneLoginSchema.parse(rawInput);
    const identifier = parsed.phoneNumber.trim();
    const isEmail = identifier.includes('@');
    const phoneE164 = isEmail
      ? null
      : normalizePhoneToE164(identifier, parsed.countryCode);

    if (!isEmail && !phoneE164) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    const rateKey = isEmail
      ? `auth:login:email:${identifier.toLowerCase()}`
      : `auth:login:phone:${phoneE164}`;
    const attempts = await this.redis.incrementRateLimit(rateKey, 900);
    if (attempts.count > 20) {
      throw new HttpException(
        'تم تجاوز الحد المسموح لمحاولات تسجيل الدخول. حاول بعد 15 دقيقة.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = isEmail
      ? await this.prisma.user.findFirst({
          where: { email: { equals: identifier, mode: 'insensitive' } },
        })
      : await this.prisma.user.findUnique({ where: { phoneE164: phoneE164! } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('تم إيقاف الحساب من قبل الإدارة');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        'الحساب مقفل مؤقتاً بسبب محاولات دخول فاشلة متكررة. حاول لاحقاً أو ادخل ببصمة جهازك.',
      );
    }

    const valid = await argon2.verify(user.passwordHash, parsed.password);
    if (!valid) {
      const nextFailed = user.failedLoginAttempts + 1;
      const shouldLock = nextFailed >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: nextFailed,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'PHONE_LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { failedLoginAttempts: nextFailed, locked: shouldLock },
        ipAddress: ip,
      });
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(user.status === 'LOCKED' ? { status: 'ACTIVE' } : {}),
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PHONE_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    const sessionResult = await this.createSessionForUser({
      user,
      ipAddress: ip,
      userAgent: ua,
    });

    return {
      requiresPasskeyEnrollment: user.status === 'ENROLLMENT_PENDING',
      ...sessionResult,
    };
  }

  // ============================================================
  // WEBAUTHN / FIDO2 PASSKEY REGISTRATION & MANAGEMENT
  // ============================================================

  async startPasskeyRegistration(userId: string, requestOrigin?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const { rpName, rpId, effectiveOrigin } = this.getWebAuthnConfig(requestOrigin);
    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userID: Uint8Array.from(Buffer.from(user.id, 'utf8')),
      userName: user.phoneE164 || user.email || user.id,
      userDisplayName: user.fullName,
      attestationType: 'none',
      timeout: 60000,
      excludeCredentials: user.passkeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });

    await this.prisma.webAuthnChallenge.create({
      data: {
        userId: user.id,
        challenge: options.challenge,
        purpose: 'REGISTRATION',
        rpId,
        origin: effectiveOrigin,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return options;
  }

  async verifyPasskeyRegistration(params: {
    userId: string;
    sessionId: string;
    response: RegistrationResponseJSON;
    friendlyName?: string;
    requestOrigin?: string;
    ip?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      include: { passkeys: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    // Adding additional passkeys to an already active account requires recent reauth
    if (user.status === 'ACTIVE' && user.passkeys.length > 0) {
      await this.assertRecentReauthentication(params.sessionId);
    }

    const challengeRecord = await this.prisma.webAuthnChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: 'REGISTRATION',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challengeRecord) {
      throw new BadRequestException('انتهت صلاحية جلسة التحقق من الجهاز. أعد المحاولة.');
    }

    // Consume atomically BEFORE cryptographic verify or within atomic check to block replays
    const consumed = await this.prisma.webAuthnChallenge.updateMany({
      where: { id: challengeRecord.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new BadRequestException('تم استخدام التحدي مسبقاً');
    }

    const { expectedOrigins } = this.getWebAuthnConfig(params.requestOrigin);
    const allowedOrigins = Array.from(
      new Set([challengeRecord.origin, ...expectedOrigins]),
    );

    const verification = await verifyRegistrationResponse({
      response: params.response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: allowedOrigins,
      expectedRPID: challengeRecord.rpId,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('تعذر تأكيد بصمة أو قفل الجهاز، أعد المحاولة');
    }

    const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
      verification.registrationInfo;

    const existingCred = await this.prisma.passkeyCredential.findUnique({
      where: { credentialId: credential.id },
    });
    if (existingCred) {
      throw new ConflictException('مفتاح المرور هذا مسجل بالفعل');
    }

    const wasPending = user.status === 'ENROLLMENT_PENDING';

    await this.prisma.$transaction(async (tx) => {
      await tx.passkeyCredential.create({
        data: {
          userId: user.id,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports ?? [],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          friendlyName: params.friendlyName?.trim() || 'جهازي المعتمد',
          aaguid,
        },
      });

      if (wasPending) {
        await tx.user.update({
          where: { id: user.id },
          data: { status: 'ACTIVE' },
        });
      }

      await tx.session.update({
        where: { id: params.sessionId },
        data: { lastRecentAuthAt: new Date() },
      });
    });

    let recoveryCodes: string[] | null = null;
    if (wasPending || (await this.prisma.recoveryCode.count({ where: { userId: user.id, usedAt: null } })) === 0) {
      recoveryCodes = await this.issueRecoveryCodesForUser(user.id);
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: wasPending ? 'PASSKEY_INITIAL_ENROLLED_ACCOUNT_ACTIVATED' : 'PASSKEY_ADDED',
      entityType: 'PasskeyCredential',
      entityId: credential.id,
      metadata: { deviceType: credentialDeviceType, backedUp: credentialBackedUp },
      ipAddress: params.ip,
    });

    return {
      verified: true,
      accountActivated: wasPending,
      recoveryCodes,
      userStatus: 'ACTIVE',
    };
  }

  async startPasskeyLogin(phoneInput?: { countryCode?: string; phoneNumber?: string }, requestOrigin?: string) {
    const { rpId, effectiveOrigin } = this.getWebAuthnConfig(requestOrigin);

    let userId: string | null = null;
    let allowCredentials: Array<{ id: string; transports?: string[] }> | undefined;

    if (phoneInput?.phoneNumber) {
      const phoneE164 = normalizePhoneToE164(
        phoneInput.phoneNumber,
        phoneInput.countryCode || '+20',
      );
      if (phoneE164) {
        const user = await this.prisma.user.findUnique({
          where: { phoneE164 },
          include: { passkeys: true },
        });
        if (user && user.passkeys.length > 0) {
          userId = user.id;
          allowCredentials = user.passkeys.map((pk) => ({
            id: pk.credentialId,
            transports: pk.transports,
          }));
        }
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      timeout: 60000,
      userVerification: 'required',
      ...(allowCredentials ? { allowCredentials } : {}),
    });

    await this.prisma.webAuthnChallenge.create({
      data: {
        userId,
        challenge: options.challenge,
        purpose: 'AUTHENTICATION',
        rpId,
        origin: effectiveOrigin,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return options;
  }

  async verifyPasskeyLogin(
    response: AuthenticationResponseJSON,
    requestOrigin?: string,
    ip?: string,
    ua?: string,
  ) {
    const passkey = await this.prisma.passkeyCredential.findUnique({
      where: { credentialId: response.id },
      include: { user: true },
    });
    if (!passkey) {
      throw new UnauthorizedException('مفتاح المرور غير مسجل في الأكاديمية');
    }
    if (passkey.user.status === 'SUSPENDED') {
      throw new ForbiddenException('الحساب موقوف مؤقتاً');
    }

    let clientChallenge: string | undefined;
    try {
      const clientData = JSON.parse(
        Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8'),
      );
      clientChallenge = clientData.challenge;
    } catch {
      throw new BadRequestException('بيانات التحقق من الجهاز غير صالحة');
    }

    if (!clientChallenge) {
      throw new BadRequestException('تعذر إتمام التحقق من الجهاز');
    }

    const challengeRecord = await this.prisma.webAuthnChallenge.findFirst({
      where: {
        challenge: clientChallenge,
        purpose: 'AUTHENTICATION',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!challengeRecord) {
      throw new UnauthorizedException('انتهت صلاحية تحدي الدخول أو تم استخدامه مسبقاً');
    }
    if (challengeRecord.userId && challengeRecord.userId !== passkey.userId) {
      throw new UnauthorizedException('عدم تطابق الحساب مع التحدي الأمني');
    }

    const consumed = await this.prisma.webAuthnChallenge.updateMany({
      where: { id: challengeRecord.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException('تم استهلاك التحدي مسبقاً');
    }

    const { expectedOrigins } = this.getWebAuthnConfig(requestOrigin);
    const allowedOrigins = Array.from(
      new Set([challengeRecord.origin, ...expectedOrigins]),
    );

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: allowedOrigins,
      expectedRPID: challengeRecord.rpId,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: Uint8Array.from(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports,
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException('تعذر التحقق من بصمة أو قفل الجهاز');
    }

    await this.prisma.passkeyCredential.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    await this.prisma.user.update({
      where: { id: passkey.userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(passkey.user.status === 'ENROLLMENT_PENDING' || passkey.user.status === 'LOCKED'
          ? { status: 'ACTIVE' }
          : {}),
      },
    });

    await this.audit.log({
      actorId: passkey.userId,
      actorRole: passkey.user.role,
      action: 'PASSKEY_LOGIN_SUCCESS',
      entityType: 'PasskeyCredential',
      entityId: passkey.id,
      ipAddress: ip,
    });

    return this.createSessionForUser({
      user: passkey.user,
      ipAddress: ip,
      userAgent: ua,
    });
  }

  async listUserPasskeys(userId: string) {
    const rows = await this.prisma.passkeyCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => ({
      id: p.id,
      credentialId: p.credentialId,
      friendlyName: p.friendlyName,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      transports: p.transports,
      lastUsedAt: p.lastUsedAt,
      createdAt: p.createdAt,
    }));
  }

  async deleteUserPasskey(
    userId: string,
    sessionId: string,
    passkeyId: string,
    ip?: string,
  ) {
    await this.assertRecentReauthentication(sessionId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const target = user.passkeys.find((p) => p.id === passkeyId);
    if (!target) throw new NotFoundException('مفتاح المرور غير موجود');

    if (user.authProvider === 'PHONE_PASSWORD' && user.passkeys.length <= 1) {
      throw new BadRequestException(
        'لا يمكن إزالة آخر جهاز موثق للحساب. أضف جهازاً بديلاً أولاً.',
      );
    }

    await this.prisma.passkeyCredential.delete({ where: { id: passkeyId } });
    await this.audit.log({
      actorId: userId,
      actorRole: user.role,
      action: 'PASSKEY_REMOVED',
      entityType: 'PasskeyCredential',
      entityId: passkeyId,
      ipAddress: ip,
    });

    return { deleted: true, id: passkeyId };
  }

  // ============================================================
  // REAUTHENTICATION (REQUIRED FOR SENSITIVE SETTINGS)
  // ============================================================

  async assertRecentReauthentication(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('الجلسة غير صالحة');
    }
    const ageMs = Date.now() - session.lastRecentAuthAt.getTime();
    if (ageMs > REAUTH_WINDOW_MS) {
      throw new ForbiddenException(
        'يتطلب هذا الإجراء الحساس إعادة تأكيد هويتك (خلال آخر 10 دقائق) بكلمة المرور أو بصمة الجهاز.',
      );
    }
  }

  async reauthWithPassword(userId: string, sessionId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new BadRequestException('الحساب لا يستخدم كلمة مرور. أكّد هويتك عبر بصمة أو قفل الجهاز.');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException('كلمة المرور غير صحيحة');
    }
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastRecentAuthAt: new Date() },
    });
    return { reauthenticated: true };
  }

  async startReauthPasskey(userId: string, requestOrigin?: string) {
    const passkeys = await this.prisma.passkeyCredential.findMany({
      where: { userId },
    });
    if (passkeys.length === 0) {
      throw new BadRequestException('لا يوجد جهاز موثق مسجل لهذا الحساب');
    }
    const { rpId, effectiveOrigin } = this.getWebAuthnConfig(requestOrigin);
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: passkeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports,
      })),
    });

    await this.prisma.webAuthnChallenge.create({
      data: {
        userId,
        challenge: options.challenge,
        purpose: 'REAUTH',
        rpId,
        origin: effectiveOrigin,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return options;
  }

  async verifyReauthPasskey(
    userId: string,
    sessionId: string,
    response: AuthenticationResponseJSON,
    requestOrigin?: string,
  ) {
    const passkey = await this.prisma.passkeyCredential.findUnique({
      where: { credentialId: response.id },
    });
    if (!passkey || passkey.userId !== userId) {
      throw new UnauthorizedException('مفتاح المرور لا يخص هذا الحساب');
    }

    const challengeRecord = await this.prisma.webAuthnChallenge.findFirst({
      where: {
        userId,
        purpose: 'REAUTH',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challengeRecord) {
      throw new BadRequestException('انتهت صلاحية التحدي الأمني');
    }

    const consumed = await this.prisma.webAuthnChallenge.updateMany({
      where: { id: challengeRecord.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new BadRequestException('تم استهلاك التحدي مسبقاً');
    }

    const { expectedOrigins } = this.getWebAuthnConfig(requestOrigin);
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: Array.from(new Set([challengeRecord.origin, ...expectedOrigins])),
      expectedRPID: challengeRecord.rpId,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: Uint8Array.from(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports,
      },
    });
    if (!verification.verified) {
      throw new UnauthorizedException('تعذر التحقق من بصمة أو قفل الجهاز');
    }

    await this.prisma.$transaction([
      this.prisma.passkeyCredential.update({
        where: { id: passkey.id },
        data: {
          counter: BigInt(verification.authenticationInfo.newCounter),
          lastUsedAt: new Date(),
        },
      }),
      this.prisma.session.update({
        where: { id: sessionId },
        data: { lastRecentAuthAt: new Date() },
      }),
    ]);

    return { reauthenticated: true };
  }

  async regenerateRecoveryCodes(userId: string, sessionId: string, ip?: string) {
    await this.assertRecentReauthentication(sessionId);
    const codes = await this.issueRecoveryCodesForUser(userId);
    await this.audit.log({
      actorId: userId,
      action: 'RECOVERY_CODES_REGENERATED',
      entityType: 'User',
      entityId: userId,
      ipAddress: ip,
    });
    return { recoveryCodes: codes };
  }

  // ============================================================
  // NON-OTP PASSWORD RECOVERY (PASSKEY / RECOVERY CODE / SUPPORT)
  // ============================================================

  async identifyRecoveryAccount(rawInput: unknown, ip?: string) {
    const { countryCode, phoneNumber } = recoveryIdentifySchema.parse(rawInput);
    const phoneE164 = normalizePhoneToE164(phoneNumber, countryCode);
    if (!phoneE164) {
      throw new BadRequestException('أدخل رقم موبايل صحيحاً');
    }

    const rl = await this.redis.incrementRateLimit(`auth:rec:id:${ip || 'local'}`, 900);
    if (rl.count > 25) {
      throw new HttpException(
        'تم تجاوز عدد محاولات الاسترداد المسموحة مؤقتاً',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { phoneE164 },
      include: {
        _count: {
          select: {
            passkeys: true,
            recoveryCodes: { where: { usedAt: null } },
          },
        },
      },
    });

    if (!user) {
      // Do not allow password reset by mobile number alone; indicate support option safely
      return {
        canSelfRecover: false,
        methods: {
          passkey: false,
          recoveryCode: false,
          supportAssisted: true,
        },
      };
    }

    return {
      canSelfRecover:
        user._count.passkeys > 0 || user._count.recoveryCodes > 0,
      methods: {
        passkey: user._count.passkeys > 0,
        recoveryCode: user._count.recoveryCodes > 0,
        supportAssisted: true,
      },
    };
  }

  async startRecoveryPasskeyChallenge(rawInput: unknown, requestOrigin?: string) {
    const { countryCode, phoneNumber } = recoveryIdentifySchema.parse(rawInput);
    const phoneE164 = normalizePhoneToE164(phoneNumber, countryCode);
    if (!phoneE164) {
      throw new BadRequestException('رقم الموبايل غير صالح');
    }

    const user = await this.prisma.user.findUnique({
      where: { phoneE164 },
      include: { passkeys: true },
    });
    if (!user || user.passkeys.length === 0) {
      throw new BadRequestException(
        'لا يوجد جهاز موثق مرتبط بهذا الحساب. استخدم كود الاسترداد أو طلب مساعدة الدعم.',
      );
    }

    const { rpId, effectiveOrigin } = this.getWebAuthnConfig(requestOrigin);
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: user.passkeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports,
      })),
    });

    await this.prisma.webAuthnChallenge.create({
      data: {
        userId: user.id,
        challenge: options.challenge,
        purpose: 'RECOVERY',
        rpId,
        origin: effectiveOrigin,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return options;
  }

  async verifyRecoveryPasskeyAssertion(params: {
    countryCode: string;
    phoneNumber: string;
    response: AuthenticationResponseJSON;
    requestOrigin?: string;
    ip?: string;
  }) {
    const phoneE164 = normalizePhoneToE164(params.phoneNumber, params.countryCode);
    if (!phoneE164) {
      throw new BadRequestException('رقم الموبايل غير صالح');
    }

    const user = await this.prisma.user.findUnique({
      where: { phoneE164 },
      include: { passkeys: true },
    });
    if (!user) {
      throw new UnauthorizedException('تعذر التحقق من الحساب');
    }

    const passkey = user.passkeys.find((p) => p.credentialId === params.response.id);
    if (!passkey) {
      throw new UnauthorizedException('مفتاح المرور لا يطابق هذا الحساب');
    }

    const challengeRecord = await this.prisma.webAuthnChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: 'RECOVERY',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challengeRecord) {
      throw new BadRequestException('انتهت صلاحية تحدي الاسترداد');
    }

    const consumed = await this.prisma.webAuthnChallenge.updateMany({
      where: { id: challengeRecord.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new BadRequestException('تم استخدام تحدي الاسترداد مسبقاً');
    }

    const { expectedOrigins } = this.getWebAuthnConfig(params.requestOrigin);
    const verification = await verifyAuthenticationResponse({
      response: params.response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: Array.from(new Set([challengeRecord.origin, ...expectedOrigins])),
      expectedRPID: challengeRecord.rpId,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: Uint8Array.from(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports,
      },
    });
    if (!verification.verified) {
      throw new UnauthorizedException('تعذر التحقق من بصمة أو قفل الجهاز');
    }

    await this.prisma.passkeyCredential.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    const rawResetToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawResetToken).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        method: 'PASSKEY',
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PASSWORD_RECOVERY_VERIFIED_BY_PASSKEY',
      entityType: 'User',
      entityId: user.id,
      ipAddress: params.ip,
    });

    return {
      resetToken: rawResetToken,
      expiresInSeconds: RESET_TOKEN_TTL_MS / 1000,
    };
  }

  async verifyRecoveryCode(rawInput: unknown, ip?: string) {
    const parsed = recoveryWithCodeSchema.parse(rawInput);
    const phoneE164 = normalizePhoneToE164(parsed.phoneNumber, parsed.countryCode);
    if (!phoneE164) {
      throw new BadRequestException('رقم الموبايل غير صالح');
    }

    const rl = await this.redis.incrementRateLimit(
      `auth:rec:code:${phoneE164}:${ip || 'local'}`,
      900,
    );
    if (rl.count > 5) {
      throw new HttpException(
        'تم تجاوز عدد محاولات كود الاسترداد المسموحة (5 محاولات كل 15 دقيقة).',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { phoneE164 } });
    if (!user) {
      throw new UnauthorizedException('كود الاسترداد غير صالح أو منتهي الاستخدام');
    }

    const codeHash = this.hashRecoveryCode(user.id, parsed.recoveryCode);

    // Atomic single-use consumption inside transaction
    const resetToken = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.recoveryCode.updateMany({
        where: {
          userId: user.id,
          codeHash,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      if (updated.count !== 1) {
        return null;
      }

      const rawResetToken = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(rawResetToken).digest('hex');

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          method: 'RECOVERY_CODE',
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      return rawResetToken;
    });

    if (!resetToken) {
      await this.audit.log({
        actorId: user.id,
        action: 'PASSWORD_RECOVERY_CODE_FAILED',
        entityType: 'User',
        entityId: user.id,
        ipAddress: ip,
      });
      throw new UnauthorizedException('كود الاسترداد غير صالح أو مستخدم مسبقاً');
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PASSWORD_RECOVERY_CODE_CONSUMED',
      entityType: 'User',
      entityId: user.id,
      metadata: { notificationChannel: user.email ? 'ACCOUNT_AUDIT_AND_EMAIL_LOG' : 'ACCOUNT_AUDIT' },
      ipAddress: ip,
    });

    return {
      resetToken,
      expiresInSeconds: RESET_TOKEN_TTL_MS / 1000,
      securityNoticeAr:
        'تم استهلاك كود الاسترداد بنجاح وإبطاله نهائياً. سجّل الحدث الأمني في حسابك.',
    };
  }

  async confirmPasswordReset(rawInput: unknown, ip?: string) {
    const parsed = resetPasswordConfirmSchema.parse(rawInput);
    const tokenHash = createHash('sha256').update(parsed.resetToken).digest('hex');

    const newPasswordHash = await argon2.hash(parsed.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const userId = await this.prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!record || record.consumedAt || record.expiresAt <= new Date()) {
        return null;
      }

      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        return null;
      }

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: newPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: 'ACTIVE',
        },
      });

      // Revoke all existing sessions on password reset
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return record.userId;
    });

    if (!userId) {
      throw new UnauthorizedException('رمز إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية');
    }

    await this.audit.log({
      actorId: userId,
      action: 'PASSWORD_RESET_COMPLETED_SESSIONS_REVOKED',
      entityType: 'User',
      entityId: userId,
      ipAddress: ip,
    });

    return {
      resetCompleted: true,
      messageAr: 'تم تحديث كلمة المرور بنجاح وإلغاء الجلسات السابقة.',
    };
  }

  async submitSupportRecoveryRequest(rawInput: unknown, ip?: string) {
    const parsed = supportRecoverySchema.parse(rawInput);
    const phoneE164 = normalizePhoneToE164(parsed.phoneNumber, parsed.countryCode);
    if (!phoneE164) {
      throw new BadRequestException('رقم الموبايل غير صالح');
    }

    const user = await this.prisma.user.findUnique({ where: { phoneE164 } });

    const created = await this.prisma.supportRecoveryRequest.create({
      data: {
        userId: user?.id ?? null,
        phoneE164,
        fullName: parsed.fullName,
        notes: parsed.notes,
        status: 'PENDING',
      },
    });

    await this.audit.log({
      actorId: user?.id,
      action: 'SUPPORT_RECOVERY_REQUEST_CREATED',
      entityType: 'SupportRecoveryRequest',
      entityId: created.id,
      ipAddress: ip,
    });

    return {
      requestId: created.id,
      status: created.status,
      messageAr:
        'تم تسجيل طلب الاسترداد المدعوم من فريق الأكاديمية. سيراجع فريق الأمان الطلب ويتواصل معك بأمان.',
    };
  }

  async updateProfile(
    userId: string,
    rawInput: { fullName?: string; email?: string | null; headlineAr?: string | null; bioAr?: string | null },
  ) {
    const input = updateProfileSchema.parse(rawInput);
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!existingUser) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const normalizedEmail =
      input.email !== undefined
        ? input.email?.trim().toLowerCase() || null
        : undefined;

    if (normalizedEmail) {
      const owner = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (owner && owner.id !== userId) {
        throw new ConflictException('البريد الإلكتروني مستخدم بحساب آخر');
      }
    }

    const emailChanged =
      normalizedEmail !== undefined &&
      normalizedEmail !== (existingUser.email?.trim().toLowerCase() || null);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName ? { fullName: input.fullName.trim() } : {}),
        ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
        ...(emailChanged ? { emailVerifiedAt: null } : {}),
        ...(input.headlineAr !== undefined
          ? { headlineAr: input.headlineAr?.trim() || null }
          : {}),
        ...(input.bioAr !== undefined ? { bioAr: input.bioAr?.trim() || null } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        emailVerifiedAt: true,
        phoneE164: true,
        role: true,
        status: true,
        headlineAr: true,
        bioAr: true,
      },
    });
  }

  // ============================================================
  // VERIFIED EMAIL LOGIN, SINGLE-USE VERIFICATION & PASSWORD RESET
  // ============================================================

  async loginWithEmail(rawInput: unknown, ip?: string, ua?: string) {
    const body = (rawInput || {}) as { email?: string; password?: string };
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !email.includes('@') || password.length < 6) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('تم إيقاف هذا الحساب مؤقتاً من قبل الإدارة');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        'تم قفل الحساب مؤقتاً بسبب محاولات دخول فاشلة متكررة. حاول بعد 15 دقيقة.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'لم يتم توثيق هذا البريد الإلكتروني بعد. يرجى تأكيد البريد عبر الرابط المرسل قبل تسجيل الدخول به.',
      );
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      const nextFailed = user.failedLoginAttempts + 1;
      const shouldLock = nextFailed >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: nextFailed,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'EMAIL_LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        ipAddress: ip,
      });
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(user.status === 'LOCKED' ? { status: 'ACTIVE' } : {}),
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'EMAIL_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    const sessionResult = await this.createSessionForUser({
      user,
      ipAddress: ip,
      userAgent: ua,
    });

    return {
      requiresPasskeyEnrollment: user.status === 'ENROLLMENT_PENDING',
      ...sessionResult,
    };
  }

  async requestEmailVerification(
    userId: string,
    rawBody: unknown,
    requestOrigin?: string,
    ip?: string,
  ) {
    const parsed = emailVerifyRequestSchema.parse(rawBody ?? {});
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, emailVerifiedAt: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const targetEmail = (parsed.email || user.email || '').trim().toLowerCase();
    if (!targetEmail) {
      throw new BadRequestException('يرجى إضافة بريد إلكتروني إلى ملفك الشخصي أولاً');
    }

    if (user.email?.toLowerCase() !== targetEmail) {
      const existingOwner = await this.prisma.user.findUnique({ where: { email: targetEmail } });
      if (existingOwner && existingOwner.id !== userId) {
        throw new ConflictException('هذا البريد الإلكتروني مستخدم بحساب آخر بالفعل');
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { email: targetEmail, emailVerifiedAt: null },
      });
    } else if (user.emailVerifiedAt) {
      return {
        alreadyVerified: true,
        sent: false,
        messageAr: 'هذا البريد الإلكتروني موثّق بالفعل.',
      };
    }

    const { rawToken, expiresAt } = await this.mailIntegrations.issueEmailActionToken({
      userId,
      email: targetEmail,
      purpose: 'EMAIL_VERIFY',
      ttlMinutes: 30,
    });

    const verifyUrl = this.mailIntegrations.buildEmailVerificationUrl(rawToken, requestOrigin);
    const dispatch = await this.mailIntegrations.dispatchEmail({
      dedupeKey: `email_verify_${userId}_${expiresAt.getTime()}`,
      category: 'EMAIL_VERIFICATION',
      recipientEmail: targetEmail,
      recipientName: user.fullName,
      subjectAr: 'تأكيد البريد الإلكتروني — أكاديمية بوصلة',
      textAr: `مرحباً ${user.fullName}، لتوثيق بريدك الإلكتروني افتح الرابط التالي (صالح لمدة 30 دقيقة ولمرة واحدة فقط): ${verifyUrl}`,
      htmlAr: `
        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0F172A; padding: 20px;">
          <h2 style="color: #1536B5;">تأكيد البريد الإلكتروني</h2>
          <p>مرحباً <strong>${user.fullName}</strong>،</p>
          <p>اضغط على الزر التالي لتوثيق بريدك الإلكتروني في أكاديمية بوصلة (الرابط صالح لمرة واحدة لمدة 30 دقيقة):</p>
          <p style="margin: 20px 0;">
            <a href="${verifyUrl}" style="background:#1536B5;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
              توثيق البريد الإلكتروني
            </a>
          </p>
        </div>
      `,
    });

    await this.audit.log({
      actorId: userId,
      action: 'EMAIL_VERIFICATION_REQUESTED',
      entityType: 'User',
      entityId: userId,
      ipAddress: ip,
      metadata: { email: targetEmail, dispatchStatus: dispatch.status },
    });

    return {
      sent: dispatch.ok,
      warningAr: dispatch.warningAr ?? null,
      messageAr: dispatch.ok
        ? 'تم إرسال رابط التوثيق إلى بريدك الإلكتروني.'
        : dispatch.warningAr || 'تعذر إرسال رابط التوثيق عبر البريد.',
    };
  }

  async confirmEmailVerification(rawBody: unknown, ip?: string) {
    const parsed = emailVerifyConfirmSchema.parse(rawBody ?? {});
    const tokenRecord = await this.mailIntegrations.consumeEmailActionToken(
      parsed.token,
      'EMAIL_VERIFY',
    );

    const user = await this.prisma.user.findUnique({
      where: { id: tokenRecord.userId },
      select: { id: true, email: true, status: true },
    });
    if (!user || user.email?.trim().toLowerCase() !== tokenRecord.email) {
      throw new BadRequestException('لم يعد البريد المرتبط بهذا الرابط مطابقاً لبريد الحساب الحالي');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'EMAIL_ADDRESS_VERIFIED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    return {
      verified: true,
      email: user.email,
      messageAr: 'تم توثيق بريدك الإلكتروني بنجاح.',
    };
  }

  async requestEmailPasswordRecovery(
    rawBody: unknown,
    requestOrigin?: string,
    ip?: string,
  ) {
    const parsed = emailRecoveryRequestSchema.parse(rawBody ?? {});
    const email = parsed.email.trim().toLowerCase();
    const genericResponse = {
      accepted: true,
      messageAr:
        'إذا كان هذا البريد الإلكتروني مسجلاً وموثّقاً لدينا، فسيتم إرسال رابط استعادة كلمة المرور خلال لحظات.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, fullName: true, email: true, emailVerifiedAt: true, status: true },
    });

    // Strict anti-enumeration & verified-email-only guarantee
    if (!user || !user.email || !user.emailVerifiedAt || user.status === 'SUSPENDED') {
      return genericResponse;
    }

    const { rawToken, expiresAt } = await this.mailIntegrations.issueEmailActionToken({
      userId: user.id,
      email: user.email.toLowerCase(),
      purpose: 'PASSWORD_RESET',
      ttlMinutes: 30,
    });

    const resetUrl = this.mailIntegrations.buildPasswordResetUrl(rawToken, requestOrigin);
    await this.mailIntegrations.dispatchEmail({
      dedupeKey: `pwd_reset_${user.id}_${expiresAt.getTime()}`,
      category: 'PASSWORD_RESET',
      recipientEmail: user.email,
      recipientName: user.fullName,
      subjectAr: 'استعادة كلمة المرور — أكاديمية بوصلة',
      textAr: `مرحباً ${user.fullName}، لتعيين كلمة مرور جديدة استخدم الرابط التالي (صالح لمرة واحدة ولمدة 30 دقيقة): ${resetUrl}`,
      htmlAr: `
        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0F172A; padding: 20px;">
          <h2 style="color: #4A1FB0;">طلب استعادة كلمة المرور</h2>
          <p>مرحباً <strong>${user.fullName}</strong>،</p>
          <p>استخدم الزر التالي لتعيين كلمة مرور جديدة (صالح لمرة واحدة فقط لمدة 30 دقيقة):</p>
          <p style="margin: 20px 0;">
            <a href="${resetUrl}" style="background:#4A1FB0;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
              تعيين كلمة مرور جديدة
            </a>
          </p>
        </div>
      `,
    });

    await this.audit.log({
      actorId: user.id,
      action: 'EMAIL_PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    return genericResponse;
  }

  async confirmEmailPasswordRecovery(rawBody: unknown, ip?: string) {
    const parsed = emailRecoveryConfirmSchema.parse(rawBody ?? {});
    const tokenRecord = await this.mailIntegrations.consumeEmailActionToken(
      parsed.token,
      'PASSWORD_RESET',
    );

    const user = await this.prisma.user.findUnique({
      where: { id: tokenRecord.userId },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user || !user.emailVerifiedAt || user.email?.toLowerCase() !== tokenRecord.email) {
      throw new BadRequestException('البريد الإلكتروني غير مؤكد أو تم تغييره');
    }

    const newHash = await argon2.hash(parsed.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      actorId: user.id,
      action: 'EMAIL_PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    return {
      resetCompleted: true,
      messageAr: 'تم تحديث كلمة المرور بنجاح عبر البريد الموثّق وإنهاء الجلسات السابقة.',
    };
  }
}
