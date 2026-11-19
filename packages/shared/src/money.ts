/**
 * Deterministic fixed-point financial arithmetic in EGP (2 decimal places -> integer piasters).
 * Strictly avoids binary floating-point rounding bugs.
 */

export type MoneyInput = number | string | { toString(): string } | null | undefined;

const MONEY_STRING_RE = /^\s*(-?)(\d+)(?:\.(\d+))?\s*$/;

/**
 * Parses a numeric/decimal value into exact integer piasters (0.01 EGP units)
 * using string decimal parsing (half-up rounding if >2 fractional digits).
 */
export function toPiasters(value: MoneyInput): number {
  if (value === null || value === undefined) return 0;
  const raw = typeof value === 'number' ? value.toFixed(6) : String(value);
  const match = MONEY_STRING_RE.exec(raw);
  if (!match) {
    throw new Error(`Invalid monetary amount: ${raw}`);
  }
  const sign = match[1] === '-' ? -1 : 1;
  const whole = Number(match[2]);
  const fracRaw = match[3] || '';
  const fracPadded = `${fracRaw}000`;
  const twoDigits = Number(fracPadded.slice(0, 2));
  const thirdDigit = Number(fracPadded[2] || '0');
  const base = whole * 100 + twoDigits + (thirdDigit >= 5 ? 1 : 0);
  return sign * base;
}

/**
 * Converts integer piasters into an exact canonical 2-decimal string (e.g., 15050 -> "150.50").
 */
export function piastersToDecimalString(piasters: number): string {
  const safe = Math.round(piasters);
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

/**
 * Deterministic half-up rounding of `numerator * multiplier / denominator` in integer space.
 */
export function mulDivRoundHalfUp(amountPiasters: number, numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  if (amountPiasters === 0 || numerator === 0) return 0;
  const prod = BigInt(Math.round(amountPiasters)) * BigInt(Math.round(numerator));
  const denom = BigInt(Math.round(denominator));
  const negative = (prod < 0n) !== (denom < 0n);
  const absProd = prod < 0n ? -prod : prod;
  const absDenom = denom < 0n ? -denom : denom;
  const rounded = (absProd * 2n + absDenom) / (2n * absDenom);
  const num = Number(rounded);
  return negative ? -num : num;
}

/**
 * Computes applied commission with configurable percentage cap on net discounted price.
 * Default cap = 50%. Free or zero-net items return 0.
 */
export function computeCappedCommission(params: {
  fixedCommissionPiasters: number;
  netItemPricePiasters: number;
  capPercent?: number;
}): {
  originalPiasters: number;
  capLimitPiasters: number;
  appliedPiasters: number;
  wasCapped: boolean;
  capReasonAr: string | null;
} {
  const net = Math.max(0, Math.round(params.netItemPricePiasters));
  const original = Math.max(0, Math.round(params.fixedCommissionPiasters));
  const capPct = params.capPercent ?? 50;

  if (net <= 0 || original <= 0) {
    return {
      originalPiasters: original,
      capLimitPiasters: 0,
      appliedPiasters: 0,
      wasCapped: false,
      capReasonAr: net <= 0 ? 'كورس مجاني أو صافي السعر صفر' : null,
    };
  }

  // Exact percentage calculation in basis points (1% = 100 bps -> 50.00% = 5000 / 10000)
  const capBps = toPiasters(capPct); // 50.00 -> 5000
  const capLimit = mulDivRoundHalfUp(net, capBps, 10_000);
  const applied = Math.min(original, capLimit);
  const wasCapped = applied < original;

  return {
    originalPiasters: original,
    capLimitPiasters: capLimit,
    appliedPiasters: applied,
    wasCapped,
    capReasonAr: wasCapped
      ? `تم تطبيق سقف العمولة (${piastersToDecimalString(capBps)}% من صافي السعر)`
      : null,
  };
}

/**
 * Computes proportional partial refund reversal for a commission item:
 * proportional = (refundAmount / netCollected) * appliedCommission,
 * ensuring cumulative reversals NEVER exceed appliedCommission and final full refund loads remainder.
 */
export function computeProportionalCommissionReversal(params: {
  appliedCommissionPiasters: number;
  alreadyReversedPiasters: number;
  refundAmountPiasters: number;
  netItemAmountPiasters: number;
  priorRefundedItemPiasters: number;
  revokeAccess?: boolean;
}): {
  reversalPiasters: number;
  isFullReversal: boolean;
  newTotalReversedPiasters: number;
} {
  const remainingCommission = Math.max(
    0,
    Math.round(params.appliedCommissionPiasters) - Math.round(params.alreadyReversedPiasters),
  );
  if (remainingCommission <= 0) {
    return {
      reversalPiasters: 0,
      isFullReversal: true,
      newTotalReversedPiasters: Math.round(params.appliedCommissionPiasters),
    };
  }

  const net = Math.max(0, Math.round(params.netItemAmountPiasters));
  const newTotalItemRefunded =
    Math.round(params.priorRefundedItemPiasters) + Math.max(0, Math.round(params.refundAmountPiasters));

  // If access revoked or cumulative refunds reach full net item price, reverse 100% of remaining commission (carries rounding delta)
  if (params.revokeAccess || (net > 0 && newTotalItemRefunded >= net)) {
    return {
      reversalPiasters: remainingCommission,
      isFullReversal: true,
      newTotalReversedPiasters: Math.round(params.alreadyReversedPiasters) + remainingCommission,
    };
  }

  if (net <= 0 || params.refundAmountPiasters <= 0) {
    return {
      reversalPiasters: 0,
      isFullReversal: false,
      newTotalReversedPiasters: Math.round(params.alreadyReversedPiasters),
    };
  }

  const rawProportion = mulDivRoundHalfUp(
    Math.round(params.appliedCommissionPiasters),
    Math.round(params.refundAmountPiasters),
    net,
  );
  const clamped = Math.min(remainingCommission, Math.max(0, rawProportion));
  return {
    reversalPiasters: clamped,
    isFullReversal: clamped >= remainingCommission,
    newTotalReversedPiasters: Math.round(params.alreadyReversedPiasters) + clamped,
  };
}

/**
 * Sequentially allocates a payment amount across ordered order items without exceeding
 * each item's remaining unpaid net balance or the total payment amount.
 */
export function allocatePaymentSequentially(params: {
  paymentAmountPiasters: number;
  items: Array<{
    orderItemId: string;
    netAmountPiasters: number;
    alreadyPaidPiasters: number;
  }>;
}): Array<{
  orderItemId: string;
  allocatedPiasters: number;
  newItemPaidPiasters: number;
  becomesFullyPaid: boolean;
}> {
  let remainingPayment = Math.max(0, Math.round(params.paymentAmountPiasters));
  const allocations: Array<{
    orderItemId: string;
    allocatedPiasters: number;
    newItemPaidPiasters: number;
    becomesFullyPaid: boolean;
  }> = [];

  for (const item of params.items) {
    if (remainingPayment <= 0) break;
    const unpaid = Math.max(0, Math.round(item.netAmountPiasters) - Math.round(item.alreadyPaidPiasters));
    if (unpaid <= 0) continue;

    const alloc = Math.min(remainingPayment, unpaid);
    remainingPayment -= alloc;
    const newPaid = Math.round(item.alreadyPaidPiasters) + alloc;
    allocations.push({
      orderItemId: item.orderItemId,
      allocatedPiasters: alloc,
      newItemPaidPiasters: newPaid,
      becomesFullyPaid: newPaid >= Math.round(item.netAmountPiasters),
    });
  }

  return allocations;
}
