/**
 * Zorqemi commission schedule.
 * Monthly rate is fixed for the entire calendar month based on the merchant's
 * net eligible sales in the PREVIOUS calendar month (Europe/Berlin).
 * All amounts are integer euro cents to avoid floating-point threshold errors.
 *
 * This module is pure. Integrate with the actual order/Stripe ledger and
 * persist monthly snapshots before using it to charge live payments.
 */
export const COMMISSION_TIERS = Object.freeze([
  { maxPreviousMonthRevenueCents: 50_000, rateBps: 300 },
  { maxPreviousMonthRevenueCents: 200_000, rateBps: 500 },
  { maxPreviousMonthRevenueCents: 500_000, rateBps: 700 },
  { maxPreviousMonthRevenueCents: 1_000_000, rateBps: 800 },
  { maxPreviousMonthRevenueCents: null, rateBps: 1000 },
]);

export function commissionRateBps(previousMonthRevenueCents = 0) {
  if (!Number.isSafeInteger(previousMonthRevenueCents) || previousMonthRevenueCents < 0) {
    throw new RangeError('previousMonthRevenueCents must be a nonnegative integer');
  }
  return COMMISSION_TIERS.find(t => t.maxPreviousMonthRevenueCents === null ||
    previousMonthRevenueCents <= t.maxPreviousMonthRevenueCents).rateBps;
}

export function commissionAmountCents(saleAmountCents, rateBps) {
  if (!Number.isSafeInteger(saleAmountCents) || saleAmountCents < 0) {
    throw new RangeError('saleAmountCents must be a nonnegative integer');
  }
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new RangeError('rateBps must be between 0 and 10000');
  }
  return Math.round(saleAmountCents * rateBps / 10_000);
}

/** Returns YYYY-MM for the prior calendar month of a YYYY-MM period. */
export function previousMonthKey(monthKey) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) throw new RangeError('Expected YYYY-MM');
  const [year, month] = monthKey.split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** A merchant with no previous-month sales (including new merchants) starts at 3%. */
export function monthlyCommissionSnapshot(monthKey, previousMonthRevenueCents = 0) {
  const priorMonth = previousMonthKey(monthKey);
  const rateBps = commissionRateBps(previousMonthRevenueCents);
  return Object.freeze({ monthKey, basedOnMonthKey: priorMonth, previousMonthRevenueCents, rateBps });
}
