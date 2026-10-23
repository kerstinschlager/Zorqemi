import { commissionForMonthlySales, berlinCommissionMonth } from './progressive-commission.js';

const ELIGIBLE = new Set(['paid', 'processing', 'shipped', 'completed']);
const cents = value => Math.round(Number(value || 0) * 100);

/**
 * Read-only commission preview; does not modify payouts or settled history.
 * Orders must be sorted by creation time (then stable ID) before calculation.
 * subtotal is merchandise excluding shipping; tax_total is excluded separately.
 * For tax-inclusive catalogs, normalize subtotal to net before calling this.
 */
export function previewMonthlyMerchantCommission(orders) {
  const months = new Map();
  const result = [];
  const sorted = [...orders].sort((a,b) =>
    new Date(a.created_at) - new Date(b.created_at) ||
    String(a.id).localeCompare(String(b.id))
  );
  for (const order of sorted) {
    if (!ELIGIBLE.has(order.status)) continue;
    const currency = String(order.currency || 'EUR').toUpperCase();
    if (currency !== 'EUR') throw new Error('commission_preview_eur_only');
    const month = berlinCommissionMonth(order.created_at);
    const key = String(order.merchant_id) + ':' + month;
    if (order.net_merchandise === undefined || order.net_merchandise === null || order.net_merchandise === '') throw new Error('net_merchandise_required');
    if (!Number.isFinite(Number(order.net_merchandise)) || Number(order.net_merchandise) < 0) throw new Error('invalid_net_merchandise');
    const merchandise = cents(order.net_merchandise);
    if (!Number.isSafeInteger(merchandise) || merchandise < 0) throw new Error('invalid_net_merchandise');
    const previous = months.get(key) || 0;
    const next = previous + merchandise;
    if (!Number.isSafeInteger(next)) throw new Error('monthly_amount_out_of_range');
    const fee = commissionForMonthlySales(next) - commissionForMonthlySales(previous);
    months.set(key, next);
    result.push({ order_id: order.id, merchant_id: order.merchant_id, month,
      net_merchandise_cents: merchandise, commission_cents: fee,
      monthly_cumulative_cents: next });
  }
  return result;
}
