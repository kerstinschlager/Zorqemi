function uuid(value) { return /^[0-9a-f-]{36}$/i.test(String(value || '')); }

export async function getMerchantPayouts(pool, merchantId, userId, limit=100) {
  if(!uuid(merchantId) || !uuid(userId)) return null;
  const owner=await pool.query(`SELECT m.id FROM merchants m JOIN merchant_users u ON u.merchant_id=m.id WHERE m.id=$1 AND u.id=$2 AND u.active=true LIMIT 1`,[merchantId,userId]);
  if(!owner.rows[0]) return null;
  const safe=Math.min(Math.max(Number(limit)||100,1),200);
  const r=await pool.query(`SELECT p.*,COALESCE((SELECT count(*) FROM merchant_payout_orders po WHERE po.payout_id=p.id),0)::int AS order_count FROM merchant_payouts p WHERE p.merchant_id=$1 ORDER BY p.created_at DESC LIMIT $2`,[merchantId,safe]);
  const b=await pool.query(`SELECT COALESCE(SUM(o.total),0) AS gross_amount, COALESCE(SUM(o.total * (1 - COALESCE((SELECT default_commission_rate FROM platform_settings WHERE id=true),10) / 100)),0) AS net_amount FROM orders o WHERE o.merchant_id=$1 AND o.status IN ('paid','processing','shipped','completed') AND NOT EXISTS (SELECT 1 FROM merchant_payout_orders po WHERE po.order_id=o.id)`,[merchantId]);
  return {payouts:r.rows,balance:b.rows[0]};
}

export async function createMerchantPayout(pool, merchantId) {
  if(!uuid(merchantId)){const e=new Error('invalid_merchant_id');e.status=400;throw e;}
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const merchant=(await client.query('SELECT id,payout_method,payout_email FROM merchants WHERE id=$1 FOR UPDATE',[merchantId])).rows[0];
    if(!merchant){const e=new Error('merchant_not_found');e.status=404;throw e;}
    const rateRow=(await client.query('SELECT default_commission_rate FROM platform_settings WHERE id=true FOR UPDATE')).rows[0];
    const rate=Number(rateRow?.default_commission_rate ?? 10);
    const orders=(await client.query(`SELECT o.id,o.currency,o.total FROM orders o WHERE o.merchant_id=$1 AND o.status IN ('paid','processing','shipped','completed') AND NOT EXISTS (SELECT 1 FROM merchant_payout_orders po WHERE po.order_id=o.id) ORDER BY o.created_at FOR UPDATE`,[merchantId])).rows;
    if(!orders.length){await client.query('ROLLBACK');return null;}
    const currency=orders[0].currency||'EUR';
    if(orders.some(o=>(o.currency||'EUR')!==currency)){const e=new Error('mixed_currency_payout');e.status=409;throw e;}
    const gross=orders.reduce((s,o)=>s+Number(o.total||0),0);
    const commission=Number((gross*rate/100).toFixed(2));
    const net=Number((gross-commission).toFixed(2));
    const payout=(await client.query(`INSERT INTO merchant_payouts(merchant_id,currency,gross_amount,commission_rate,commission_amount,net_amount,status,payout_method,payout_email) VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$8) RETURNING *`,[merchantId,currency,gross,rate,commission,net,merchant.payout_method||null,merchant.payout_email||null])).rows[0];
    for(const o of orders) await client.query('INSERT INTO merchant_payout_orders(payout_id,order_id,order_total) VALUES($1,$2,$3)',[payout.id,o.id,o.total]);
    await client.query('COMMIT');
    return {...payout,order_count:orders.length};
  } catch(e) { try{await client.query('ROLLBACK')}catch{} throw e; } finally {client.release();}
}

export async function markPayoutPaid(pool, payoutId, paidBy=null) {
  if(!uuid(payoutId)){const e=new Error('invalid_payout_id');e.status=400;throw e;}
  const r=await pool.query(`UPDATE merchant_payouts SET status='paid',paid_at=COALESCE(paid_at,now()),paid_by=$2 WHERE id=$1 AND status='pending' RETURNING *`,[payoutId,uuid(paidBy)?paidBy:null]);
  return r.rows[0]??null;
}

export async function listAdminPayouts(pool, limit=100) {
  const safe=Math.min(Math.max(Number(limit)||100,1),200);
  const r=await pool.query(`SELECT p.*,m.name AS merchant_name,COALESCE((SELECT count(*) FROM merchant_payout_orders po WHERE po.payout_id=p.id),0)::int AS order_count FROM merchant_payouts p JOIN merchants m ON m.id=p.merchant_id ORDER BY p.created_at DESC LIMIT $1`,[safe]);
  return r.rows;
}

export async function getPlatformCommission(pool) {
  const r=await pool.query('SELECT default_commission_rate FROM platform_settings WHERE id=true');
  return Number(r.rows[0]?.default_commission_rate ?? 10);
}

export async function setPlatformCommission(pool, rate) {
  const value=Number(rate);
  if(!Number.isFinite(value)||value<0||value>100){const e=new Error('invalid_commission_rate');e.status=400;throw e;}
  const r=await pool.query('UPDATE platform_settings SET default_commission_rate=$1,updated_at=now() WHERE id=true RETURNING default_commission_rate',[value]);
  return Number(r.rows[0].default_commission_rate);
}


export async function listAdminMerchants(pool, limit=200) {
  const safe=Math.min(Math.max(Number(limit)||200,1),500);
  const r=await pool.query(`SELECT m.id,m.name,m.email,m.payout_method,m.payout_email,m.published,
    COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.merchant_id=m.id AND o.status IN ('paid','processing','shipped','completed') AND NOT EXISTS (SELECT 1 FROM merchant_payout_orders po WHERE po.order_id=o.id)),0) AS pending_gross,
    COALESCE((SELECT SUM(o.total * (1 - COALESCE((SELECT default_commission_rate FROM platform_settings WHERE id=true),10) / 100)) FROM orders o WHERE o.merchant_id=m.id AND o.status IN ('paid','processing','shipped','completed') AND NOT EXISTS (SELECT 1 FROM merchant_payout_orders po WHERE po.order_id=o.id)),0) AS pending_net
    FROM merchants m
    ORDER BY m.created_at DESC
    LIMIT $1`,[safe]);
  return r.rows;
}
