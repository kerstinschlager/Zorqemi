// Progressive monthly commission calculation. Monetary inputs are integer euro cents.
// Each tier applies only to the portion of a merchant's monthly net merchandise sales
// within its bounds; VAT and shipping are excluded by the caller.
export const COMMISSION_TIERS = Object.freeze([
  { fromCents: 0, rateBps: 300 },
  { fromCents: 50000, rateBps: 500 },
  { fromCents: 200000, rateBps: 700 },
  { fromCents: 500000, rateBps: 900 },
  { fromCents: 1000000, rateBps: 1100 },
  { fromCents: 2000000, rateBps: 1300 },
  { fromCents: 5000000, rateBps: 1500 },
]);

function validateCents(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name + ' must be nonnegative integer cents');
}

// Returns total commission in cents, rounding only the cumulative amount.
// Calculate each order's fee as commissionForMonthlySales(newTotal) -
// commissionForMonthlySales(previousTotal), so rounding is consistent
// regardless of how orders are grouped.
export function commissionForMonthlySales(netMerchandiseCents) {
  validateCents(netMerchandiseCents, 'netMerchandiseCents');
  let numerator = 0;
  for (let i = 0; i < COMMISSION_TIERS.length; i++) {
    const tier = COMMISSION_TIERS[i];
    const next = COMMISSION_TIERS[i + 1]?.fromCents ?? netMerchandiseCents;
    const portion = Math.max(0, Math.min(netMerchandiseCents, next) - tier.fromCents);
    numerator += portion * tier.rateBps;
  }
  if (!Number.isSafeInteger(numerator)) throw new RangeError('commission exceeds safe integer precision');
  return Math.round(numerator / 10000);
}

export function incrementalCommission(previousMonthlyNetCents, orderNetCents) {
  validateCents(previousMonthlyNetCents, 'previousMonthlyNetCents');
  validateCents(orderNetCents, 'orderNetCents');
  const next = previousMonthlyNetCents + orderNetCents;
  if (!Number.isSafeInteger(next)) throw new RangeError('monthly sales exceed safe integer precision');
  return commissionForMonthlySales(next) - commissionForMonthlySales(previousMonthlyNetCents);
}

// UTC month key; for German calendar-month accounting, pass the Europe/Berlin
// business-local month from the application/database rather than UTC dates.
export function commissionMonthKey(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('invalid year/month');
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0');
}

const berlinMonthFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit'
});

// Calendar-month reset is based on the Europe/Berlin local date,
// including the daylight-saving-time transitions.
export function berlinCommissionMonth(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new RangeError('invalid timestamp');
  const parts = berlinMonthFormatter.formatToParts(date);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  return commissionMonthKey(year, month);
}
