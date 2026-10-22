// Proposed monthly progressive commission schedule for Zorqemi.
// Monetary inputs and outputs are integer cents to avoid floating-point rounding.
// Apply each bracket only to the part of monthly eligible turnover within it.
// Not yet wired into checkout, Stripe Connect, refunds or payouts.
export const COMMISSION_BRACKETS = Object.freeze([
  { fromCents: 0, rateBps: 500 },
  { fromCents: 50000, rateBps: 600 },
  { fromCents: 200000, rateBps: 700 },
  { fromCents: 500000, rateBps: 900 },
  { fromCents: 1000000, rateBps: 1100 },
  { fromCents: 2000000, rateBps: 1300 },
  { fromCents: 5000000, rateBps: 1500 }
]);

export function calculateMonthlyCommissionCents(eligibleTurnoverCents) {
  if (!Number.isSafeInteger(eligibleTurnoverCents) || eligibleTurnoverCents < 0) {
    throw new RangeError('eligibleTurnoverCents must be a nonnegative safe integer');
  }
  let total = 0;
  for (let i = 0; i < COMMISSION_BRACKETS.length; i++) {
    const bracket = COMMISSION_BRACKETS[i];
    const next = COMMISSION_BRACKETS[i + 1]?.fromCents ?? eligibleTurnoverCents;
    const portion = Math.max(0, Math.min(eligibleTurnoverCents, next) - bracket.fromCents);
    total += portion * bracket.rateBps / 10000;
  }
  return Math.round(total);
}

export function calculateOrderCommissionDeltaCents(previousEligibleTurnoverCents, newEligibleOrderCents) {
  if (!Number.isSafeInteger(newEligibleOrderCents) || newEligibleOrderCents < 0 ||
      !Number.isSafeInteger(previousEligibleTurnoverCents) || previousEligibleTurnoverCents < 0 ||
      !Number.isSafeInteger(previousEligibleTurnoverCents + newEligibleOrderCents)) {
    throw new RangeError('invalid order turnover');
  }
  return calculateMonthlyCommissionCents(previousEligibleTurnoverCents + newEligibleOrderCents)
    - calculateMonthlyCommissionCents(previousEligibleTurnoverCents);
}
