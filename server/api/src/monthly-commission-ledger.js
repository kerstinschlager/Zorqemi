import { berlinCommissionMonth, commissionForMonthlySales } from './progressive-commission.js';

const asCents = value => Math.round(Number(value) * 100);
const asEuros = value => (value / 100).toFixed(2);

// Must be called inside a transaction after locking the merchant row.
// Snapshot only eligible paid orders. Existing ledger entries are immutable.
export async function accrueMonthlyCommissions(client, merchantId) {
  const orders = (await client.query(`
    SELECT o.id,o.merchant_id,o.currency,o.subtotal,o.created_at,
           o.status,s.vat_enabled,s.vat_rate
      FROM orders o
      LEFT JOIN shop_settings s ON s.merchant_id=o.merchant_id
     WHERE o.merchant_id=$1 AND o.status IN ('paid','processing','shipped','completed')
     ORDER BY o.created_at,o.id FOR UPDATE OF o`, [merchantId])).rows;
  const existing = (await client.query(
    'SELECT order_id,commission_month,net_merchandise,commission_amount FROM merchant_order_commissions WHERE merchant_id=$1',
    [merchantId])).rows;
  const byOrder = new Set(existing.map(x=>String(x.order_id)));
  const totals = new Map();
  for (const x of existing) {
    const old = totals.get(x.commission_month) || 0;
    totals.set(x.commission_month,old+asCents(x.net_merchandise));
  }
  let created = 0;
  for (const order of orders) {
    if (byOrder.has(String(order.id))) continue;
    if (String(order.currency).toUpperCase() !== 'EUR') throw new Error('commission_requires_eur');
    // Checkout currently computes VAT in addition to subtotal.
    // If tax treatment is unknown, stop rather than silently miscalculate.
    if (order.vat_enabled === null) throw new Error('commission_vat_configuration_missing');
    const amount = Number(order.subtotal);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('invalid_order_subtotal');
    const month = berlinCommissionMonth(order.created_at);
    const previous = totals.get(month) || 0;
    const next = previous + asCents(amount);
    const fee = commissionForMonthlySales(next)-commissionForMonthlySales(previous);
    await client.query(`
      INSERT INTO merchant_order_commissions
        (order_id,merchant_id,commission_month,currency,net_merchandise,commission_amount)
      VALUES ($1,$2,$3,'EUR',$4,$5) ON CONFLICT(order_id) DO NOTHING`,
      [order.id,merchantId,month,asEuros(asCents(amount)),asEuros(fee)]);
    totals.set(month,next);
    created++;
  }
  return { created, months: Object.fromEntries(totals) };
}
