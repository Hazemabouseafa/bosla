import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { EmailActionTokenPurpose, Prisma } from '@bosla/db';
import {
  decryptSecretAesGcm,
  encryptSecretAesGcm,
  googleOAuthConfigUpdateSchema,
  isMaskedSecretPlaceholder,
  maskSecretValue,
  smtpMailConfigUpdateSchema,
  smtpTestEmailSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';

export interface ResolvedGoogleOAuthConfig {
  isEnabled: boolean;
  clientId: string;
  clientSecret: string;
}

export interface ResolvedSmtpConfig {
  isEnabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export interface DispatchEmailInput {
  dedupeKey?: string;
  category: string;
  recipientEmail: string;
  recipientName?: string | null;
  subjectAr: string;
  htmlAr: string;
  textAr: string;
  payload?: Record<string, unknown>;
}

export interface DispatchEmailResult {
  logId: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  ok: boolean;
  alreadySent?: boolean;
  warningAr?: string;
}

@Injectable()
export class IntegrationsMailService {
  private readonly logger = new Logger(IntegrationsMailService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private getEncryptionKey(): string {
    return (
      process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY ||
      process.env.PAYMOB_CONFIG_ENCRYPTION_KEY ||
      process.env.SESSION_SECRET ||
      'bosla-integrations-encryption-key-2026'
    );
  }

  private getPublicApiOrigin(requestOrigin?: string): string {
    return (
      process.env.API_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ||
      process.env.WEB_PUBLIC_URL ||
      requestOrigin ||
      'https://academy.bosla.com'
    ).replace(/\/$/, '');
  }

  private getPublicWebOrigin(requestOrigin?: string): string {
    return (
      process.env.WEB_PUBLIC_URL ||
      process.env.APP_URL ||
      requestOrigin ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private encryptSecret(plain?: string | null): string | null {
    const val = (plain || '').trim();
    if (!val) return null;
    return encryptSecretAesGcm(val, this.getEncryptionKey());
  }

  private decryptSecret(enc?: string | null): string {
    if (!enc) return '';
    try {
      return decryptSecretAesGcm(enc, this.getEncryptionKey());
    } catch {
      return '';
    }
  }

  // ============================================================================
  // 1. GOOGLE OAUTH RUNTIME CONFIGURATION
  // ============================================================================

  async resolveGoogleConfig(): Promise<ResolvedGoogleOAuthConfig> {
    const row = await this.prisma.systemIntegrationConfig
      .findUnique({ where: { providerKey: 'GOOGLE_OAUTH' } })
      .catch(() => null);

    if (row) {
      const pub = (row.publicConfig as Record<string, unknown> | null) ?? {};
      const sec = (row.encryptedSecrets as Record<string, string | null> | null) ?? {};
      const clientId = String(pub.clientId || '').trim();
      const clientSecret = this.decryptSecret(sec.clientSecretEnc);
      return {
        isEnabled: Boolean(row.isEnabled && clientId),
        clientId,
        clientSecret,
      };
    }

    const envId = (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const envSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    return {
      isEnabled: Boolean(envId),
      clientId: envId,
      clientSecret: envSecret,
    };
  }

  async getGoogleConfigForAdmin(requestOrigin?: string) {
    const row = await this.prisma.systemIntegrationConfig
      .findUnique({ where: { providerKey: 'GOOGLE_OAUTH' } })
      .catch(() => null);
    const resolved = await this.resolveGoogleConfig();
    const callbackUrl = `${this.getPublicApiOrigin(requestOrigin)}/api/v1/auth/google/callback`;

    return {
      providerKey: 'GOOGLE_OAUTH',
      isEnabled: Boolean(row ? row.isEnabled : resolved.isEnabled),
      clientId: resolved.clientId,
      clientSecretMasked: maskSecretValue(resolved.clientSecret),
      hasClientSecret: Boolean(resolved.clientSecret),
      callbackUrl,
      readiness: {
        hasClientId: Boolean(resolved.clientId),
        hasClientSecret: Boolean(resolved.clientSecret),
        readyForSignIn: Boolean(resolved.isEnabled && resolved.clientId),
        readyForOAuthCodeFlow: Boolean(resolved.isEnabled && resolved.clientId && resolved.clientSecret),
      },
      source: row ? 'DATABASE' : resolved.clientId ? 'ENV_FALLBACK' : 'UNCONFIGURED',
      updatedAt: row?.updatedAt ?? null,
      updatedByName: row?.updatedByName ?? null,
    };
  }

  async updateGoogleConfigForAdmin(
    actor: AuthenticatedContextUser,
    rawBody: unknown,
    ipAddress?: string,
    requestOrigin?: string,
  ) {
    const parsed = googleOAuthConfigUpdateSchema.parse(rawBody ?? {});
    const existing = await this.prisma.systemIntegrationConfig.findUnique({
      where: { providerKey: 'GOOGLE_OAUTH' },
    });
    const existingSecrets = (existing?.encryptedSecrets as Record<string, string | null> | null) ?? {};
    const existingPlainSecret = this.decryptSecret(existingSecrets.clientSecretEnc);

    let nextSecretEnc = existingSecrets.clientSecretEnc || null;
    if (parsed.clientSecret !== undefined) {
      const candidate = (parsed.clientSecret || '').trim();
      if (!candidate) {
        nextSecretEnc = null;
      } else if (!isMaskedSecretPlaceholder(candidate)) {
        nextSecretEnc = this.encryptSecret(candidate);
      }
    } else if (!nextSecretEnc && existingPlainSecret) {
      nextSecretEnc = this.encryptSecret(existingPlainSecret);
    }

    const cleanClientId = (parsed.clientId || '').trim();
    if (parsed.isEnabled && !cleanClientId) {
      throw new BadRequestException('يرجى إدخال معرف العميل (Google Client ID) قبل تفعيل تسجيل الدخول بجوجل');
    }

    await this.prisma.systemIntegrationConfig.upsert({
      where: { providerKey: 'GOOGLE_OAUTH' },
      update: {
        isEnabled: parsed.isEnabled,
        publicConfig: { clientId: cleanClientId },
        encryptedSecrets: { clientSecretEnc: nextSecretEnc },
        updatedById: actor.id,
        updatedByName: actor.fullName,
      },
      create: {
        providerKey: 'GOOGLE_OAUTH',
        isEnabled: parsed.isEnabled,
        publicConfig: { clientId: cleanClientId },
        encryptedSecrets: { clientSecretEnc: nextSecretEnc },
        updatedById: actor.id,
        updatedByName: actor.fullName,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ADMIN_GOOGLE_OAUTH_CONFIG_UPDATED',
      entityType: 'SystemIntegrationConfig',
      entityId: 'GOOGLE_OAUTH',
      ipAddress,
      metadata: {
        isEnabled: parsed.isEnabled,
        hasClientId: Boolean(cleanClientId),
        hasClientSecret: Boolean(nextSecretEnc),
      },
    });

    return this.getGoogleConfigForAdmin(requestOrigin);
  }

  // ============================================================================
  // 2. OUTBOUND SMTP MAIL CONFIGURATION & DISPATCH
  // ============================================================================

  async resolveSmtpConfig(): Promise<ResolvedSmtpConfig> {
    const row = await this.prisma.systemIntegrationConfig
      .findUnique({ where: { providerKey: 'SMTP_MAIL' } })
      .catch(() => null);

    if (row) {
      const pub = (row.publicConfig as Record<string, unknown> | null) ?? {};
      const sec = (row.encryptedSecrets as Record<string, string | null> | null) ?? {};
      const host = String(pub.host || '').trim();
      const port = Number(pub.port || 587);
      const secure = Boolean(pub.secure);
      const username = String(pub.username || '').trim();
      const fromName = String(pub.fromName || 'BOSLA Academy').trim() || 'BOSLA Academy';
      const fromEmail = String(pub.fromEmail || '').trim();
      const password = this.decryptSecret(sec.passwordEnc);

      return {
        isEnabled: Boolean(row.isEnabled && host && fromEmail),
        host,
        port,
        secure,
        username,
        password,
        fromName,
        fromEmail,
      };
    }

    const host = (process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const username = (process.env.SMTP_USER || '').trim();
    const password = (process.env.SMTP_PASS || '').trim();
    const fromEmail = (process.env.SMTP_FROM_EMAIL || username || '').trim();
    const fromName = (process.env.SMTP_FROM_NAME || 'BOSLA Academy').trim();
    return {
      isEnabled: Boolean(host && fromEmail),
      host,
      port,
      secure,
      username,
      password,
      fromName,
      fromEmail,
    };
  }

  async getSmtpConfigForAdmin() {
    const row = await this.prisma.systemIntegrationConfig
      .findUnique({ where: { providerKey: 'SMTP_MAIL' } })
      .catch(() => null);
    const resolved = await this.resolveSmtpConfig();

    return {
      providerKey: 'SMTP_MAIL',
      isEnabled: Boolean(row ? row.isEnabled : resolved.isEnabled),
      host: resolved.host,
      port: resolved.port,
      secure: resolved.secure,
      username: resolved.username,
      passwordMasked: maskSecretValue(resolved.password),
      hasPassword: Boolean(resolved.password),
      fromName: resolved.fromName,
      fromEmail: resolved.fromEmail,
      readiness: {
        hasHost: Boolean(resolved.host),
        hasFromEmail: Boolean(resolved.fromEmail),
        ready: Boolean(resolved.isEnabled && resolved.host && resolved.fromEmail),
      },
      source: row ? 'DATABASE' : resolved.host ? 'ENV_FALLBACK' : 'UNCONFIGURED',
      lastVerifiedAt: row?.lastVerifiedAt ?? null,
      lastVerifyStatus: row?.lastVerifyStatus ?? null,
      lastVerifyMessageAr: row?.lastVerifyMessageAr ?? null,
      updatedAt: row?.updatedAt ?? null,
      updatedByName: row?.updatedByName ?? null,
    };
  }

  async updateSmtpConfigForAdmin(
    actor: AuthenticatedContextUser,
    rawBody: unknown,
    ipAddress?: string,
  ) {
    const parsed = smtpMailConfigUpdateSchema.parse(rawBody ?? {});
    const existing = await this.prisma.systemIntegrationConfig.findUnique({
      where: { providerKey: 'SMTP_MAIL' },
    });
    const existingSecrets = (existing?.encryptedSecrets as Record<string, string | null> | null) ?? {};

    let nextPasswordEnc = existingSecrets.passwordEnc || null;
    if (parsed.password !== undefined) {
      const candidate = (parsed.password || '').trim();
      if (!candidate) {
        nextPasswordEnc = null;
      } else if (!isMaskedSecretPlaceholder(candidate)) {
        nextPasswordEnc = this.encryptSecret(candidate);
      }
    }

    const host = (parsed.host || '').trim();
    const username = (parsed.username || '').trim();
    const fromName = (parsed.fromName || 'BOSLA Academy').trim() || 'BOSLA Academy';
    const fromEmail = (parsed.fromEmail || '').trim();

    if (parsed.isEnabled && (!host || !fromEmail)) {
      throw new BadRequestException('يرجى إدخال خادم SMTP وبريد المُرسِل (From Email) قبل تفعيل إرسال البريد');
    }

    await this.prisma.systemIntegrationConfig.upsert({
      where: { providerKey: 'SMTP_MAIL' },
      update: {
        isEnabled: parsed.isEnabled,
        publicConfig: {
          host,
          port: parsed.port,
          secure: parsed.secure,
          username,
          fromName,
          fromEmail,
        },
        encryptedSecrets: { passwordEnc: nextPasswordEnc },
        updatedById: actor.id,
        updatedByName: actor.fullName,
      },
      create: {
        providerKey: 'SMTP_MAIL',
        isEnabled: parsed.isEnabled,
        publicConfig: {
          host,
          port: parsed.port,
          secure: parsed.secure,
          username,
          fromName,
          fromEmail,
        },
        encryptedSecrets: { passwordEnc: nextPasswordEnc },
        updatedById: actor.id,
        updatedByName: actor.fullName,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ADMIN_SMTP_MAIL_CONFIG_UPDATED',
      entityType: 'SystemIntegrationConfig',
      entityId: 'SMTP_MAIL',
      ipAddress,
      metadata: {
        isEnabled: parsed.isEnabled,
        host,
        port: parsed.port,
        secure: parsed.secure,
        fromEmail,
      },
    });

    return this.getSmtpConfigForAdmin();
  }

  private createTransport(cfg: ResolvedSmtpConfig) {
    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth:
        cfg.username && cfg.password
          ? { user: cfg.username, pass: cfg.password }
          : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  async sendTestSmtpEmail(
    actor: AuthenticatedContextUser,
    rawBody: unknown,
    ipAddress?: string,
  ) {
    const parsed = smtpTestEmailSchema.parse(rawBody ?? {});
    const cfg = await this.resolveSmtpConfig();
    if (!cfg.host || !cfg.fromEmail) {
      throw new BadRequestException('أدخل إعدادات خادم SMTP وبريد المُرسِل ثم احفظها قبل إرسال رسالة الاختبار');
    }

    const now = new Date();
    const subjectAr = 'رسالة اختبار إعدادات البريد — أكاديمية بوصلة';
    const textAr = `مرحباً ${actor.fullName}، هذه رسالة اختبار من إعدادات البريد الصادر في أكاديمية بوصلة (${now.toISOString()}).`;
    const htmlAr = `
      <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.7; color: #0F172A; padding: 20px;">
        <h2 style="color: #1536B5;">تم التحقق من إعدادات البريد الصادر</h2>
        <p>مرحباً <strong>${actor.fullName}</strong>،</p>
        <p>تم إرسال هذه الرسالة بنجاح عبر خادم البريد المهيأ داخل منصة أكاديمية بوصلة.</p>
        <p style="font-size: 12px; color: #64748B;">الخادم: ${cfg.host}:${cfg.port}</p>
      </div>
    `;

    try {
      const transport = this.createTransport(cfg);
      await transport.verify();
      await transport.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: parsed.recipientEmail,
        subject: subjectAr,
        text: textAr,
        html: htmlAr,
      });

      await this.prisma.systemIntegrationConfig.upsert({
        where: { providerKey: 'SMTP_MAIL' },
        update: {
          lastVerifiedAt: now,
          lastVerifyStatus: 'VERIFIED',
          lastVerifyMessageAr: `تم الإرسال الاختباري بنجاح إلى ${parsed.recipientEmail}`,
        },
        create: {
          providerKey: 'SMTP_MAIL',
          isEnabled: cfg.isEnabled,
          publicConfig: {
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            username: cfg.username,
            fromName: cfg.fromName,
            fromEmail: cfg.fromEmail,
          },
          lastVerifiedAt: now,
          lastVerifyStatus: 'VERIFIED',
          lastVerifyMessageAr: `تم الإرسال الاختباري بنجاح إلى ${parsed.recipientEmail}`,
        },
      });

      const log = await this.prisma.emailDispatchLog.create({
        data: {
          category: 'SMTP_TEST',
          recipientEmail: parsed.recipientEmail,
          recipientName: actor.fullName,
          subjectAr,
          status: 'SENT',
          attemptCount: 1,
          sentAt: now,
        },
      });

      await this.audit.log({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'ADMIN_SMTP_TEST_SENT',
        entityType: 'EmailDispatchLog',
        entityId: log.id,
        ipAddress,
        metadata: { recipientEmail: parsed.recipientEmail },
      });

      return {
        ok: true,
        messageAr: `تم إرسال رسالة الاختبار بنجاح إلى ${parsed.recipientEmail}`,
        logId: log.id,
      };
    } catch (err: any) {
      const errMsg = String(err?.message || 'فشل الاتصال بخادم SMTP').slice(0, 400);
      await this.prisma.systemIntegrationConfig
        .update({
          where: { providerKey: 'SMTP_MAIL' },
          data: {
            lastVerifiedAt: now,
            lastVerifyStatus: 'ERROR',
            lastVerifyMessageAr: errMsg,
          },
        })
        .catch(() => {});

      await this.prisma.emailDispatchLog.create({
        data: {
          category: 'SMTP_TEST',
          recipientEmail: parsed.recipientEmail,
          recipientName: actor.fullName,
          subjectAr,
          status: 'FAILED',
          attemptCount: 1,
          lastErrorAr: errMsg,
        },
      });

      throw new BadRequestException(`تعذر إرسال رسالة الاختبار: ${errMsg}`);
    }
  }

  /**
   * Idempotent transactional email dispatch with graceful non-throwing fallback
   * and exponential retry scheduling for transient SMTP failures.
   */
  async dispatchEmail(input: DispatchEmailInput): Promise<DispatchEmailResult> {
    if (input.dedupeKey) {
      const existing = await this.prisma.emailDispatchLog.findUnique({
        where: { dedupeKey: input.dedupeKey },
      });
      if (existing?.status === 'SENT') {
        return {
          logId: existing.id,
          status: 'SENT',
          ok: true,
          alreadySent: true,
        };
      }
    }

    const logRecord = input.dedupeKey
      ? await this.prisma.emailDispatchLog.upsert({
          where: { dedupeKey: input.dedupeKey },
          update: {
            recipientEmail: input.recipientEmail,
            recipientName: input.recipientName ?? null,
            subjectAr: input.subjectAr,
            payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
          },
          create: {
            dedupeKey: input.dedupeKey,
            category: input.category,
            recipientEmail: input.recipientEmail,
            recipientName: input.recipientName ?? null,
            subjectAr: input.subjectAr,
            status: 'PENDING',
            payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        })
      : await this.prisma.emailDispatchLog.create({
          data: {
            category: input.category,
            recipientEmail: input.recipientEmail,
            recipientName: input.recipientName ?? null,
            subjectAr: input.subjectAr,
            status: 'PENDING',
            payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });

    return this.attemptDelivery(logRecord.id, input.htmlAr, input.textAr);
  }

  private async attemptDelivery(
    logId: string,
    htmlAr: string,
    textAr: string,
  ): Promise<DispatchEmailResult> {
    const cfg = await this.resolveSmtpConfig();
    if (!cfg.isEnabled || !cfg.host || !cfg.fromEmail) {
      const warningAr = 'تم حفظ العملية في النظام، لكن البريد الإلكتروني لم يُرسل لعدم تفعيل أو استكمال إعدادات SMTP.';
      await this.prisma.emailDispatchLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          attemptCount: { increment: 1 },
          lastErrorAr: warningAr,
        },
      });
      return { logId, status: 'FAILED', ok: false, warningAr };
    }

    const logRow = await this.prisma.emailDispatchLog.findUnique({ where: { id: logId } });
    if (!logRow) {
      return { logId, status: 'FAILED', ok: false, warningAr: 'سجل البريد غير موجود' };
    }

    try {
      const transport = this.createTransport(cfg);
      await transport.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: logRow.recipientEmail,
        subject: logRow.subjectAr,
        text: textAr,
        html: htmlAr,
      });

      await this.prisma.emailDispatchLog.update({
        where: { id: logId },
        data: {
          status: 'SENT',
          attemptCount: { increment: 1 },
          sentAt: new Date(),
          lastErrorAr: null,
          nextRetryAt: null,
        },
      });

      return { logId, status: 'SENT', ok: true };
    } catch (err: any) {
      const errMsg = String(err?.message || 'خطأ في إرسال البريد').slice(0, 400);
      const nextAttempt = logRow.attemptCount + 1;
      const canRetry = nextAttempt < logRow.maxAttempts && process.env.NODE_ENV !== 'test';
      const delayMs = canRetry ? Math.min(60000, 3000 * Math.pow(2, nextAttempt - 1)) : 0;

      await this.prisma.emailDispatchLog.update({
        where: { id: logId },
        data: {
          status: canRetry ? 'PENDING' : 'FAILED',
          attemptCount: nextAttempt,
          nextRetryAt: canRetry ? new Date(Date.now() + delayMs) : null,
          lastErrorAr: errMsg,
        },
      });

      if (canRetry) {
        this.logger.warn(`Scheduling email retry (${nextAttempt}/${logRow.maxAttempts}) for ${logId}`);
        setTimeout(() => {
          void this.attemptDelivery(logId, htmlAr, textAr).catch(() => {});
        }, delayMs).unref?.();
      }

      return {
        logId,
        status: canRetry ? 'PENDING' : 'FAILED',
        ok: false,
        warningAr: `تعذر إرسال البريد حالياً (${errMsg}) — يمكنك متابعة حالة الإرسال من سجل البريد.`,
      };
    }
  }

  async listEmailDispatchLogs(limit = 60) {
    return this.prisma.emailDispatchLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  async getPublicAuthCapabilities() {
    const [google, smtp] = await Promise.all([
      this.resolveGoogleConfig(),
      this.resolveSmtpConfig(),
    ]);
    return {
      googleEnabled: Boolean(google.isEnabled && google.clientId),
      googleClientId: google.isEnabled && google.clientId ? google.clientId : null,
      googleOAuthCodeFlowEnabled: Boolean(google.isEnabled && google.clientId && google.clientSecret),
      smtpEmailVerificationEnabled: Boolean(smtp.isEnabled && smtp.host && smtp.fromEmail),
      passkeyEnabled: true,
      phonePasswordEnabled: true,
      emailPasswordEnabled: true,
    };
  }

  // ============================================================================
  // 3. SINGLE-USE EMAIL VERIFICATION & PASSWORD RESET TOKENS
  // ============================================================================

  hashActionToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async issueEmailActionToken(params: {
    userId: string;
    email: string;
    purpose: EmailActionTokenPurpose;
    ttlMinutes?: number;
  }) {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashActionToken(rawToken);
    const expiresAt = new Date(Date.now() + (params.ttlMinutes ?? 30) * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.emailActionToken.updateMany({
        where: {
          userId: params.userId,
          purpose: params.purpose,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      }),
      this.prisma.emailActionToken.create({
        data: {
          userId: params.userId,
          email: params.email.trim().toLowerCase(),
          purpose: params.purpose,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    return { rawToken, expiresAt };
  }

  async consumeEmailActionToken(rawToken: string, purpose: EmailActionTokenPurpose) {
    const tokenHash = this.hashActionToken(rawToken.trim());
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.emailActionToken.findUnique({ where: { tokenHash } });
      if (!record || record.purpose !== purpose || record.consumedAt || record.expiresAt <= now) {
        throw new BadRequestException('رابط التحقق غير صالح أو منتهي الصلاحية');
      }

      const claimed = await tx.emailActionToken.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('تم استخدام هذا الرابط مسبقاً');
      }

      return record;
    });
  }

  buildEmailVerificationUrl(rawToken: string, requestOrigin?: string): string {
    return `${this.getPublicWebOrigin(requestOrigin)}/login?verifyEmailToken=${encodeURIComponent(rawToken)}`;
  }

  buildPasswordResetUrl(rawToken: string, requestOrigin?: string): string {
    return `${this.getPublicWebOrigin(requestOrigin)}/recovery?token=${encodeURIComponent(rawToken)}`;
  }
}
