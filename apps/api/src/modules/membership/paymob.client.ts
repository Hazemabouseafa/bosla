import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
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

  get isSandboxMode(): boolean {
    return (process.env.PAYMOB_MODE || 'sandbox') !== 'live';
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

  verifyTransactionHmac(obj: Record<string, any>, providedHmac: string | undefined): boolean {
    const secret = process.env.PAYMOB_HMAC_SECRET || (this.isSandboxMode ? 'bosla_sandbox_hmac_secret' : '');
    if (!secret || !providedHmac) {
      return false;
    }
    const expected = this.computeTransactionHmac(obj, secret);
    const a = Buffer.from(expected.toLowerCase(), 'utf8');
    const b = Buffer.from(providedHmac.toLowerCase(), 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async createCheckout(input: PaymobInitCheckoutInput): Promise<PaymobInitCheckoutResult> {
    const baseUrl = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com';

    // Option 1: Paymob Unified Checkout (Intention API v1)
    if (this.hasV1Keys) {
      const [firstName, ...rest] = input.billingUser.fullName.trim().split(/\s+/);
      const lastName = rest.join(' ') || 'Student';
      const integrationId = Number(process.env.PAYMOB_INTEGRATION_ID_CARD);

      const response = await fetch(`${baseUrl}/v1/intention/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
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
        process.env.PAYMOB_PUBLIC_KEY!,
      )}&clientSecret=${encodeURIComponent(clientSecret)}`;

      return {
        mode: this.isSandboxMode ? 'sandbox-api' : 'live',
        checkoutUrl,
        paymobIntentionId: String(data.id || ''),
        paymobOrderId: data.intention_order_id ? String(data.intention_order_id) : undefined,
        rawPayload: data,
      };
    }

    // Option 2: Classic Paymob Acceptance 3-Step Flow
    if (this.hasClassicKeys) {
      const authRes = await fetch(`${baseUrl}/api/auth/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.PAYMOB_API_KEY }),
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
          integration_id: Number(process.env.PAYMOB_INTEGRATION_ID_CARD),
        }),
      });
      if (!keyRes.ok) throw new Error('Paymob payment key failed');
      const keyData = (await keyRes.json()) as { token: string };

      const iframeId = process.env.PAYMOB_IFRAME_ID!;
      const checkoutUrl = `${baseUrl}/api/acceptance/iframes/${iframeId}?payment_token=${encodeURIComponent(keyData.token)}`;

      return {
        mode: this.isSandboxMode ? 'sandbox-api' : 'live',
        checkoutUrl,
        paymobOrderId: String(orderData.id),
        paymentKey: keyData.token,
        rawPayload: { orderId: orderData.id },
      };
    }

    // Option 3: Local Sandbox Simulator when real merchant keys are not yet provisioned
    if (!this.isSandboxMode) {
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
