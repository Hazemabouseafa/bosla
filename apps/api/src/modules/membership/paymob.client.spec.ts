import { afterEach, describe, expect, it } from 'vitest';
import { PaymobClient } from './paymob.client';

describe('PaymobClient HMAC verification', () => {
  const originalEnv = {
    PAYMOB_MODE: process.env.PAYMOB_MODE,
    PAYMOB_HMAC_SECRET: process.env.PAYMOB_HMAC_SECRET,
  };

  afterEach(() => {
    if (originalEnv.PAYMOB_MODE === undefined) {
      delete process.env.PAYMOB_MODE;
    } else {
      process.env.PAYMOB_MODE = originalEnv.PAYMOB_MODE;
    }
    if (originalEnv.PAYMOB_HMAC_SECRET === undefined) {
      delete process.env.PAYMOB_HMAC_SECRET;
    } else {
      process.env.PAYMOB_HMAC_SECRET = originalEnv.PAYMOB_HMAC_SECRET;
    }
  });

  it('computes and verifies a valid Paymob transaction HMAC-SHA512', () => {
    process.env.PAYMOB_MODE = 'live';
    process.env.PAYMOB_HMAC_SECRET = 'test_paymob_hmac_secret_123456';
    const client = new PaymobClient();

    const payload = {
      amount_cents: 45000,
      created_at: '2026-11-13T10:00:00',
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      id: 987654,
      integration_id: 112233,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 556677 },
      owner: 123,
      pending: false,
      source_data: {
        pan: '2345',
        sub_type: 'MasterCard',
        type: 'card',
      },
      success: true,
    };

    const sig = client.computeTransactionHmac(payload, process.env.PAYMOB_HMAC_SECRET);
    expect(sig).toMatch(/^[a-f0-9]{128}$/);
    expect(client.verifyTransactionHmac(payload, sig)).toBe(true);
    expect(client.verifyTransactionHmac(payload, sig.toUpperCase())).toBe(true);
  });

  it('rejects tampered amounts, mismatched lengths, and missing live secrets', () => {
    process.env.PAYMOB_MODE = 'live';
    process.env.PAYMOB_HMAC_SECRET = 'test_paymob_hmac_secret_123456';
    const client = new PaymobClient();

    const payload = {
      amount_cents: 45000,
      currency: 'EGP',
      id: 987654,
      order: { id: 556677 },
      source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
      success: true,
    };

    const sig = client.computeTransactionHmac(payload, process.env.PAYMOB_HMAC_SECRET);
    expect(client.verifyTransactionHmac({ ...payload, amount_cents: 100 }, sig)).toBe(false);
    expect(client.verifyTransactionHmac(payload, 'short-sig')).toBe(false);
    expect(client.verifyTransactionHmac(payload, undefined)).toBe(false);

    delete process.env.PAYMOB_HMAC_SECRET;
    expect(client.verifyTransactionHmac(payload, sig)).toBe(false);
  });
});
