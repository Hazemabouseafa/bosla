import type { PaymobInitCheckoutInput, PaymobInitCheckoutResult } from './paymob.client';

export const PAYMENT_GATEWAY_PROVIDER = Symbol('PAYMENT_GATEWAY_PROVIDER');

export interface PublicPaymentGatewayConfig {
  provider: string;
  mode: 'SANDBOX' | 'LIVE';
  currency: string;
  autoRenewSupported: boolean;
  enabledMethods: Array<{
    code: string;
    labelAr: string;
    electronic: boolean;
  }>;
}

/**
 * Provider-agnostic electronic payment gateway contract.
 * Keeps Orders, Subscriptions, DirectPurchases, and Entitlements decoupled from Paymob-specific transport details.
 */
export interface PaymentGatewayProvider {
  readonly providerCode: string;
  readonly isSandboxMode: boolean;
  readonly hasRecurringEnabled: boolean;

  getPublicConfig(): PublicPaymentGatewayConfig;
  createCheckout(input: PaymobInitCheckoutInput): Promise<PaymobInitCheckoutResult>;
  verifyTransactionHmac(payloadObj: Record<string, any>, providedHmac: string | undefined): boolean;
}
