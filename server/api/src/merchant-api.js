function requireUuid(value, field) {
  if (!/^[0-9a-f-]{36}$/i.test(String(value || ''))) {
    const error = new Error(`invalid_${field}`); error.status = 400; throw error;
  }
}

export async function getMerchantForOwner(pool, merchantId, userId) {
  requireUuid(merchantId, 'merchant_id');
  requireUuid(userId, 'user_id');
  const result = await pool.query(
    `SELECT m.id,m.owner_id,m.name,m.slug,m.shop_slug,m.email,m.published,m.created_at,m.updated_at
       FROM merchants m JOIN merchant_users u ON u.merchant_id=m.id
      WHERE m.id=$1 AND u.id=$2 AND u.active=true LIMIT 1`,
    [merchantId, userId]
  );
  return result.rows[0] ?? null;
}

export async function listMerchantProducts(pool, merchantId, userId) {
  const merchant = await getMerchantForOwner(pool, merchantId, userId); if (!merchant) return null;
  const result = await pool.query(`SELECT p.*,COALESCE((SELECT json_agg(v ORDER BY v.created_at) FROM product_variants v WHERE v.product_id=p.id),'[]'::json) variants FROM products p WHERE p.merchant_id=$1 ORDER BY p.created_at DESC`, [merchantId]);
  return { merchant, products: result.rows };
}

export async function createMerchantProduct(pool, merchantId, userId, body) {
  const merchant = await getMerchantForOwner(pool, merchantId, userId); if (!merchant) return null;
  const name=String(body?.name||'').trim(), price=Number(body?.price), stock=Number(body?.stock??0);
  if (!name || !Number.isFinite(price) || price<0 || !Number.isInteger(stock) || stock<0) { const e=new Error('invalid_product'); e.status=400; throw e; }
  const client=await pool.connect();
  try { await client.query('BEGIN');
    const product=await client.query(`INSERT INTO products(merchant_id,name,description,price,stock,active,source_provider,source_product_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[merchantId,name,body.description?String(body.description):null,price,stock,body.active!==false,body.source_provider||null,body.source_product_id||null]);
    for(const v of Array.isArray(body.variants)?body.variants:[]) { const vn=String(v.name||'').trim(); if(!vn) continue; await client.query(`INSERT INTO product_variants(product_id,name,sku,price,stock,active,source_variant_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,[product.rows[0].id,vn,v.sku?String(v.sku):null,v.price==null?null:Number(v.price),Number(v.stock??0),v.active!==false,v.source_variant_id||null]); }
    await client.query('COMMIT'); return product.rows[0];
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function updateMerchantProduct(pool, merchantId, userId, productId, body) {
  requireUuid(productId,'product_id'); if(!await getMerchantForOwner(pool,merchantId,userId)) return null;
  const fields=[],values=[]; const add=(c,v)=>{fields.push(`${c}=$${values.length+1}`);values.push(v);};
  if(body.name!==undefined)add('name',String(body.name).trim()); if(body.description!==undefined)add('description',body.description==null?null:String(body.description)); if(body.price!==undefined)add('price',Number(body.price)); if(body.stock!==undefined)add('stock',Number(body.stock)); if(body.active!==undefined)add('active',Boolean(body.active)); if(!fields.length)return null;
  values.push(merchantId,productId); const r=await pool.query(`UPDATE products SET ${fields.join(',')},updated_at=now() WHERE merchant_id=$${values.length-1} AND id=$${values.length} RETURNING *`,values); return r.rows[0]??null;
}

export async function getMerchantOrders(pool, merchantId, userId, limit=100) {
  if(!await getMerchantForOwner(pool,merchantId,userId))return null; const safe=Math.min(Math.max(Number(limit)||100,1),200);
  const r=await pool.query(`SELECT o.*,COALESCE((SELECT json_agg(oi ORDER BY oi.created_at) FROM order_items oi WHERE oi.order_id=o.id AND oi.merchant_id=$1),'[]'::json) items FROM orders o WHERE o.merchant_id=$1 OR EXISTS(SELECT 1 FROM order_items x WHERE x.order_id=o.id AND x.merchant_id=$1) ORDER BY o.created_at DESC LIMIT $2`,[merchantId,safe]); return r.rows;
}

export async function updateMerchantOrder(pool, merchantId, userId, orderId, status) {
  requireUuid(orderId,'order_id'); const allowed=new Set(['new','processing','shipped','completed','cancelled']); if(!allowed.has(status)){const e=new Error('invalid_status');e.status=400;throw e;} if(!await getMerchantForOwner(pool,merchantId,userId))return null;
  const r=await pool.query(`UPDATE orders SET status=$1,updated_at=now() WHERE id=$2 AND (merchant_id=$3 OR EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=orders.id AND oi.merchant_id=$3)) AND status NOT IN('completed','cancelled') RETURNING *`,[status,orderId,merchantId]); return r.rows[0]??null;
}

export async function getShopSettings(pool, merchantId, userId) { if(!await getMerchantForOwner(pool,merchantId,userId))return null; const r=await pool.query('SELECT * FROM shop_settings WHERE merchant_id=$1',[merchantId]); if(r.rows[0])return r.rows[0]; const c=await pool.query('INSERT INTO shop_settings(merchant_id) VALUES($1) RETURNING *',[merchantId]); return c.rows[0]; }

export async function updateShopSettings(pool, merchantId, userId, body) { if(!await getMerchantForOwner(pool,merchantId,userId))return null; await getShopSettings(pool,merchantId,userId); const allowed=['currency','country_code','vat_enabled','vat_rate','shipping_flat','free_shipping_from','checkout_enabled','stripe_account_id']; const fields=[],values=[]; for(const key of allowed)if(body?.[key]!==undefined){fields.push(`${key}=$${values.length+1}`);values.push(body[key]);} if(!fields.length)return getShopSettings(pool,merchantId,userId); values.push(merchantId); const r=await pool.query(`UPDATE shop_settings SET ${fields.join(',')},updated_at=now() WHERE merchant_id=$${values.length} RETURNING *`,values); return r.rows[0]; }
