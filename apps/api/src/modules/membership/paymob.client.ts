import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { decryptSecretAesGcm } from '@bosla/shared';
import { PrismaService } from '../../core/prisma.service';
import type {
  PaymentGatewayProvider,
  PublicPaymentGatewayConfig,
} from './payment-gateway.interface';

export interface PaymobInitCheckoutInput {
  amountCents: number;
  currency: string;
  merchantOrderId: string;
  billingUser: {
    fullName: string;
    email: string | null;
    phoneE164: string | null;
  };
  planNameAr: string;
  returnUrl: string;
  webhookUrl: string;
}

export interface PaymobInitCheckoutResult {
  mode: 'live' | 'sandbox-api' | 'local-sandbox-simulator';
  checkoutUrl: string;
  paymobOrderId?: string;
  paymobIntentionId?: string;
  paymentKey?: string;
  rawPayload: Record<string, unknown>;
}

/**
 * Official Paymob HMAC-SHA512 field order for transaction callbacks & webhooks.
 */
const PAYMOB_HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const;

function readNestedValue(obj: Record<string, any>, dottedPath: string): string {
  const parts = dottedPath.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return '';
    current = current[part];
  }
  if (current === null || current === undefined) return '';
  return String(current);
}

@Injectable()
export class PaymobClient implements PaymentGatewayProvider {
  readonly providerCode = 'PAYMOB';
  private readonly logger = new Logger(PaymobClient.name);

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService,
  ) {}

  get isSandboxMode(): boolean {
    return (process.env.PAYMOB_MODE || 'sandbox') !== 'live';
  }

  private getEncryptionKey(): string {
    return (
      process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY ||
      process.env.JWT_ACCESS_SECRET ||
      'bosla_default_gateway_encryption_key_32_chars_min'
    );
  }

  async resolveRuntimeCredentials(): Promise<{
    isEnabled: boolean;
    isSandboxMode: boolean;
    apiKey: string;
    integrationIdCard: string;
    integrationIdWallet: string;
    iframeId: string;
    hmacSecret: string;
    publicKey: string;
    secretKey: string;
  }> {
    let dbMode: 'TEST' | 'LIVE' | null = null;
    let dbEnabled = true;
    let dbEnv: Record<string, string> = {};

    if (this.prisma?.paymentGatewayConfig) {
      try {
        const row = await this.prisma.paymentGatewayConfig.findUnique({
          where: { providerKey: 'paymob' },
        });
        if (row) {
          dbEnabled = row.isEnabled;
          dbMode = row.mode === 'LIVE' ? 'LIVE' : 'TEST';
          const encKey = this.getEncryptionKey();
          const dec = (val: string | null) =>
            val ? decryptSecretAesGcm(val, encKey) : '';
          if (dbMode === 'LIVE') {
            dbEnv = {
              apiKey: dec(row.liveApiKeyEnc),
              integrationIdCard: row.liveIntegrationId || '',
              integrationIdWallet: row.liveWalletIntegrationId || '',
              iframeId: row.liveIframeId || '',
              hmacSecret: dec(row.liveHmacSecretEnc),
              publicKey: row.livePublicKey || '',
              secretKey: dec(row.liveSecretKeyEnc),
            };
          } else {
            dbEnv = {
              apiKey: dec(row.testApiKeyEnc),
              integrationIdCard: row.testIntegrationId || '',
              integrationIdWallet: row.testWalletIntegrationId || '',
              iframeId: row.testIframeId || '',
              hmacSecret: dec(row.testHmacSecretEnc),
              publicKey: row.testPublicKey || '',
              secretKey: dec(row.testSecretKeyEnc),
            };
          }
        }
      } catch {
        // Fallback cleanly to environment variables
      }
    }

    const isSandboxMode = dbMode ? dbMode !== 'LIVE' : this.isSandboxMode;
    return {
      isEnabled: dbEnabled,
      isSandboxMode,
      apiKey: dbEnv.apiKey || process.env.PAYMOB_API_KEY || '',
      integrationIdCard: dbEnv.integrationIdCard || process.env.PAYMOB_INTEGRATION_ID_CARD || '',
      integrationIdWallet:
        dbEnv.integrationIdWallet || process.env.PAYMOB_INTEGRATION_ID_WALLET || '',
      iframeId: dbEnv.iframeId || process.env.PAYMOB_IFRAME_ID || '',
      hmacSecret:
        dbEnv.hmacSecret ||
        process.env.PAYMOB_HMAC_SECRET ||
        (isSandboxMode ? 'bosla_sandbox_hmac_secret' : ''),
      publicKey: dbEnv.publicKey || process.env.PAYMOB_PUBLIC_KEY || '',
      secretKey: dbEnv.secretKey || process.env.PAYMOB_SECRET_KEY || '',
    };
  }

  getPublicConfig(): PublicPaymentGatewayConfig {
    const walletConfigured = Boolean(
      this.isSandboxMode || process.env.PAYMOB_INTEGRATION_ID_WALLET,
    );
    const enabledMethods: PublicPaymentGatewayConfig['enabledMethods'] = [
      {
        code: 'PAYMOB_CARD',
        labelAr: 'بطاقة بنكية إلكترونية (فيزا / ماستركارد / ميزة)',
        electronic: true,
      },
    ];
    if (walletConfigured) {
      enabledMethods.push({
        code: 'PAYMOB_WALLET',
        labelAr: 'محفظة إلكترونية (فودافون كاش / اتصالات / أورنج)',
        electronic: true,
      });
    }
    enabledMethods.push(
      {
        code: 'BANK_TRANSFER',
        labelAr: 'تحويل بنكي (يتطلب مراجعة وإيصال سداد)',
        electronic: false,
      },
      {
        code: 'OFFLINE_TRAINING',
        labelAr: 'سداد نقدي بمقر الأكاديمية',
        electronic: false,
      },
    );

    return {
      provider: this.providerCode,
      mode: this.isSandboxMode ? 'SANDBOX' : 'LIVE',
      currency: 'EGP',
      autoRenewSupported: this.hasRecurringEnabled,
      enabledMethods,
    };
  }

  get hasV1Keys(): boolean {
    return Boolean(
      process.env.PAYMOB_SECRET_KEY &&
        process.env.PAYMOB_PUBLIC_KEY &&
        process.env.PAYMOB_INTEGRATION_ID_CARD,
    );
  }

  get hasClassicKeys(): boolean {
    return Boolean(
      process.env.PAYMOB_API_KEY &&
        process.env.PAYMOB_INTEGRATION_ID_CARD &&
        process.env.PAYMOB_IFRAME_ID,
    );
  }

  get hasRecurringEnabled(): boolean {
    return process.env.PAYMOB_RECURRING_ENABLED === 'true';
  }

  computeTransactionHmac(obj: Record<string, any>, secret: string): string {
    const concatenated = PAYMOB_HMAC_FIELDS.map((field) => readNestedValue(obj, field)).join('');
    return createHmac('sha512', secret).update(concatenated).digest('hex');
  }

  verifyTransactionHmac(
    obj: Record<string, any>,
    providedHmac: string | undefined,
    customSecret?: string,
  ): boolean {
    const secret =
      customSecret ||
      process.env.PAYMOB_HMAC_SECRET ||
      (this.isSandboxMode ? 'bosla_sandbox_hmac_secret' : '');
    if (!secret || !providedHmac) {
      return false;
    }
    const expected = this.computeTransactionHmac(obj, secret);
    const a = Buffer.from(expected.toLowerCase(), 'utf8');
    const b = Buffer.from(providedHmac.toLowerCase(), 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async verifyTransactionHmacAsync(
    obj: Record<string, any>,
    providedHmac: string | undefined,
  ): Promise<boolean> {
    const creds = await this.resolveRuntimeCredentials();
    return this.verifyTransactionHmac(obj, providedHmac, creds.hmacSecret);
  }

  async createCheckout(input: PaymobInitCheckoutInput): Promise<PaymobInitCheckoutResult> {
    const baseUrl = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com';
    const creds = await this.resolveRuntimeCredentials();
    const hasV1 = Boolean(creds.secretKey && creds.publicKey && creds.integrationIdCard);
    const hasClassic = Boolean(creds.apiKey && creds.integrationIdCard && creds.iframeId);

    // Option 1: Paymob Unified Checkout (Intention API v1)
    if (hasV1) {
      const [firstName, ...rest] = input.billingUser.fullName.trim().split(/\s+/);
      const lastName = rest.join(' ') || 'Student';
      const integrationId = Number(creds.integrationIdCard);

      const response = await fetch(`${baseUrl}/v1/intention/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${creds.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amountCents,
          currency: input.currency,
          payment_methods: [integrationId],
          items: [
            {
              name: input.planNameAr,
              amount: input.amountCents,
              description: input.planNameAr,
              quantity: 1,
            },
          ],
          billing_data: {
            first_name: firstName || 'Student',
            last_name: lastName,
            email: input.billingUser.email || 'student@boslaagri.com',
            phone_number: input.billingUser.phoneE164 || '+201000000000',
            country: 'EG',
          },
          special_reference: input.merchantOrderId,
          notification_url: input.webhookUrl,
          redirection_url: input.returnUrl,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Paymob v1 intention error: ${response.status} ${text}`);
        throw new Error('تعذر تهيئة عملية الدفع الإلكتروني حالياً');
      }

      const data = (await response.json()) as Record<string, any>;
      const clientSecret = String(data.client_secret || '');
      const checkoutUrl = `${baseUrl}/unifiedcheckout/?publicKey=${encodeURIComponent(
        creds.publicKey,
      )}&clientSecret=${encodeURIComponent(clientSecret)}`;

      return {
        mode: creds.isSandboxMode ? 'sandbox-api' : 'live',
        checkoutUrl,
        paymobIntentionId: String(data.id || ''),
        paymobOrderId: data.intention_order_id ? String(data.intention_order_id) : undefined,
        rawPayload: data,
      };
    }

    // Option 2: Classic Paymob Acceptance 3-Step Flow
    if (hasClassic) {
      const authRes = await fetch(`${baseUrl}/api/auth/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: creds.apiKey }),
      });
      if (!authRes.ok) throw new Error('Paymob auth failed');
      const authData = (await authRes.json()) as { token: string };

      const orderRes = await fetch(`${baseUrl}/api/ecommerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_token: authData.token,
          delivery_needed: false,
          amount_cents: String(input.amountCents),
          currency: input.currency,
          merchant_order_id: input.merchantOrderId,
          items: [],
        }),
      });
      if (!orderRes.ok) throw new Error('Paymob order creation failed');
      const orderData = (await orderRes.json()) as { id: number };

      const [firstName, ...rest] = input.billingUser.fullName.trim().split(/\s+/);
      const lastName = rest.join(' ') || 'Student';
      const keyRes = await fetch(`${baseUrl}/api/acceptance/payment_keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_token: authData.token,
          amount_cents: String(input.amountCents),
          expiration: 3600,
          order_id: orderData.id,
          billing_data: {
            apartment: 'NA',
            email: input.billingUser.email || 'student@boslaagri.com',
            floor: 'NA',
            first_name: firstName || 'Student',
            street: 'NA',
            building: 'NA',
            phone_number: input.billingUser.phoneE164 || '+201000000000',
            shipping_method: 'NA',
            postal_code: 'NA',
            city: 'Cairo',
            country: 'EG',
            last_name: lastName,
            state: 'Cairo',
          },
          currency: input.currency,
          integration_id: Number(creds.integrationIdCard),
        }),
      });
      if (!keyRes.ok) throw new Error('Paymob payment key failed');
      const keyData = (await keyRes.json()) as { token: string };

      const iframeId = creds.iframeId;
      const checkoutUrl = `${baseUrl}/api/acceptance/iframes/${iframeId}?payment_token=${encodeURIComponent(keyData.token)}`;

      return {
        mode: creds.isSandboxMode ? 'sandbox-api' : 'live',
        checkoutUrl,
        paymobOrderId: String(orderData.id),
        paymentKey: keyData.token,
        rawPayload: { orderId: orderData.id },
      };
    }

    // Option 3: Local Sandbox Simulator when real merchant keys are not yet provisioned
    if (!creds.isSandboxMode) {
      throw new Error('بوابة الدفع الإلكتروني غير مفعّلة بالكامل حالياً');
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const simOrderId = `sim_order_${input.merchantOrderId}`;
    return {
      mode: 'local-sandbox-simulator',
      checkoutUrl: `${appUrl}/membership/sandbox-checkout?merchantOrderId=${encodeURIComponent(
        input.merchantOrderId,
      )}&amountCents=${encodeURIComponent(String(input.amountCents))}&planName=${encodeURIComponent(
        input.planNameAr,
      )}`,
      paymobOrderId: simOrderId,
      rawPayload: {
        simulator: true,
        merchantOrderId: input.merchantOrderId,
        note: 'Paymob sandbox keys not configured; using authenticated local sandbox test flow',
      },
    };
  }
}
