// ============================================================================
// BIZ-11: Financial precision utilities for VND calculations
// VND is a zero-decimal currency, so amounts should always be whole numbers.
// These utilities prevent floating-point precision errors in JS arithmetic.
// ============================================================================

/**
 * Safely sum an array of financial amounts, rounding to avoid float drift.
 * Use this instead of `array.reduce((s, x) => s + x, 0)` for money.
 */
export function safeSum(amounts: number[]): number {
  // Kahan summation to minimize floating-point error
  let sum = 0;
  let compensation = 0;
  for (const val of amounts) {
    const y = val - compensation;
    const t = sum + y;
    compensation = (t - sum) - y;
    sum = t;
  }
  return Math.round(sum);
}

/**
 * Round a financial amount to the nearest whole VND.
 */
export function roundVND(amount: number): number {
  return Math.round(amount);
}

/**
 * Safely compute a percentage of a financial amount.
 * Returns a whole number (VND).
 */
export function percentOf(amount: number, pct: number): number {
  return Math.round(amount * pct);
}

/**
 * Convert a Prisma Decimal to a safe JS number.
 * Prisma Decimal fields come as Decimal objects; Number() conversion is safe
 * for amounts up to ~9 quadrillion (well within VND range).
 */
export function toNumber(decimal: any): number {
  if (decimal === null || decimal === undefined) return 0;
  return Number(decimal);
}
