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
  const description=body?.description==null?null:String(body.description).trim();
  const imageUrl=body?.image_url==null?null:String(body.image_url).trim();
  const category=body?.category==null?null:String(body.category).trim();
  if (!name || name.length>200 || !Number.isFinite(price) || price<0 || !Number.isInteger(stock) || stock<0 || description?.length>5000 || imageUrl?.length>2000 || category?.length>120) { const e=new Error('invalid_product'); e.status=400; throw e; }
  const client=await pool.connect();
  try { await client.query('BEGIN');
    const product=await client.query(`INSERT INTO products(merchant_id,name,description,price,stock,active,image_url,category,source_provider,source_product_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[merchantId,name,description,price,stock,body.active!==false,imageUrl,category,body.source_provider||null,body.source_product_id||null]);
    for(const v of Array.isArray(body.variants)?body.variants:[]) { const vn=String(v.name||'').trim(); if(!vn) continue; await client.query(`INSERT INTO product_variants(product_id,name,sku,price,stock,active,source_variant_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,[product.rows[0].id,vn,v.sku?String(v.sku):null,v.price==null?null:Number(v.price),Number(v.stock??0),v.active!==false,v.source_variant_id||null]); }
    await client.query('COMMIT'); return product.rows[0];
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function updateMerchantProduct(pool, merchantId, userId, productId, body) {
  requireUuid(productId,'product_id'); if(!await getMerchantForOwner(pool,merchantId,userId)) return null;
  const fields=[],values=[]; const add=(c,v)=>{fields.push(`${c}=$${values.length+1}`);values.push(v);};
  if(body.name!==undefined){const v=String(body.name).trim();if(!v||v.length>200){const e=new Error('invalid_product');e.status=400;throw e;}add('name',v);} if(body.description!==undefined){const v=body.description==null?null:String(body.description).trim();if(v?.length>5000){const e=new Error('invalid_product');e.status=400;throw e;}add('description',v);} if(body.image_url!==undefined){const v=body.image_url==null?null:String(body.image_url).trim();if(v?.length>2000){const e=new Error('invalid_product');e.status=400;throw e;}add('image_url',v);} if(body.category!==undefined){const v=body.category==null?null:String(body.category).trim();if(v?.length>120){const e=new Error('invalid_product');e.status=400;throw e;}add('category',v);} if(body.price!==undefined){const v=Number(body.price);if(!Number.isFinite(v)||v<0){const e=new Error('invalid_product');e.status=400;throw e;}add('price',v);} if(body.stock!==undefined){const v=Number(body.stock);if(!Number.isInteger(v)||v<0){const e=new Error('invalid_product');e.status=400;throw e;}add('stock',v);} if(body.active!==undefined)add('active',Boolean(body.active)); if(!fields.length)return null;
  values.push(merchantId,productId); const r=await pool.query(`UPDATE products SET ${fields.join(',')},updated_at=now() WHERE merchant_id=$${values.length-1} AND id=$${values.length} RETURNING *`,values); return r.rows[0]??null;
}

export async function getMerchantOrders(pool, merchantId, userId, limit=100) {
  if(!await getMerchantForOwner(pool,merchantId,userId))return null; const safe=Math.min(Math.max(Number(limit)||100,1),200);
  const r=await pool.query(`SELECT o.*,COALESCE((SELECT json_agg(oi ORDER BY oi.created_at) FROM order_items oi WHERE oi.order_id=o.id AND oi.merchant_id=$1),'[]'::json) items FROM orders o WHERE o.merchant_id=$1 OR EXISTS(SELECT 1 FROM order_items x WHERE x.order_id=o.id AND x.merchant_id=$1) ORDER BY o.created_at DESC LIMIT $2`,[merchantId,safe]); return r.rows;
}

export async function updateMerchantOrder(pool, merchantId, userId, orderId, status) {
  requireUuid(orderId,'order_id'); const allowed=new Set(['new','paid','processing','shipped','completed','cancelled']); if(!allowed.has(status)){const e=new Error('invalid_status');e.status=400;throw e;} if(!await getMerchantForOwner(pool,merchantId,userId))return null;
  const r=await pool.query(`UPDATE orders SET status=$1,updated_at=now() WHERE id=$2 AND (merchant_id=$3 OR EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=orders.id AND oi.merchant_id=$3)) AND status NOT IN('completed','cancelled') RETURNING *`,[status,orderId,merchantId]); return r.rows[0]??null;
}

export async function getShopSettings(pool, merchantId, userId) { if(!await getMerchantForOwner(pool,merchantId,userId))return null; const r=await pool.query('SELECT * FROM shop_settings WHERE merchant_id=$1',[merchantId]); if(r.rows[0])return r.rows[0]; const c=await pool.query('INSERT INTO shop_settings(merchant_id) VALUES($1) RETURNING *',[merchantId]); return c.rows[0]; }

export async function updateShopSettings(pool, merchantId, userId, body) { if(!await getMerchantForOwner(pool,merchantId,userId))return null; await getShopSettings(pool,merchantId,userId); const fields=[],values=[]; const add=(key,value)=>{fields.push(`${key}=${values.length+1}`);values.push(value);}; if(body?.currency!==undefined){const v=String(body.currency).trim().toUpperCase();if(!/^[A-Z]{3}$/.test(v)){const e=new Error('invalid_currency');e.status=400;throw e;}add('currency',v);} if(body?.country_code!==undefined){const v=String(body.country_code).trim().toUpperCase();if(!/^[A-Z]{2}$/.test(v)){const e=new Error('invalid_country_code');e.status=400;throw e;}add('country_code',v);} if(body?.vat_enabled!==undefined){if(typeof body.vat_enabled!=='boolean'){const e=new Error('invalid_vat_enabled');e.status=400;throw e;}add('vat_enabled',body.vat_enabled);} for(const key of ['vat_rate','shipping_flat','free_shipping_from'])if(body?.[key]!==undefined){const v=body[key]===null?null:Number(body[key]);if(v!==null&&(!Number.isFinite(v)||v<0)){const e=new Error(`invalid_${key}`);e.status=400;throw e;}if(key==='vat_rate'&&v!==null&&v>100){const e=new Error('invalid_vat_rate');e.status=400;throw e;}add(key,v);} if(body?.checkout_enabled!==undefined){if(typeof body.checkout_enabled!=='boolean'){const e=new Error('invalid_checkout_enabled');e.status=400;throw e;}add('checkout_enabled',body.checkout_enabled);} if(body?.payment_provider!==undefined){const v=String(body.payment_provider??'').trim();if(v.length>80){const e=new Error('invalid_payment_provider');e.status=400;throw e;}add('payment_provider',v);} if(body?.stripe_account_id!==undefined){const v=body.stripe_account_id===null?null:String(body.stripe_account_id).trim();if(v?.length>255){const e=new Error('invalid_stripe_account_id');e.status=400;throw e;}add('stripe_account_id',v);} if(!fields.length)return getShopSettings(pool,merchantId,userId); values.push(merchantId); const r=await pool.query(`UPDATE shop_settings SET ${fields.join(',')},updated_at=now() WHERE merchant_id=${values.length} RETURNING *`,values); return r.rows[0]; }

export async function updateMerchantShipping(pool, merchantId, userId, orderId, body) {
  requireUuid(orderId,'order_id');
  if(!await getMerchantForOwner(pool,merchantId,userId)) return null;
  const carrier=body?.shipping_carrier==null?null:String(body.shipping_carrier).trim();
  const tracking=body?.tracking_number==null?null:String(body.tracking_number).trim();
  const trackingUrl=body?.tracking_url==null?null:String(body.tracking_url).trim();
  if(carrier?.length>120||tracking?.length>200||trackingUrl?.length>2000||(trackingUrl&&!/^https?:\/\//i.test(trackingUrl))){const e=new Error('invalid_shipping');e.status=400;throw e;}
  const r=await pool.query(`UPDATE orders SET shipping_carrier=$1,tracking_number=$2,tracking_url=$3,shipped_at=CASE WHEN $2 IS NOT NULL OR $3 IS NOT NULL THEN COALESCE(shipped_at,now()) ELSE shipped_at END,updated_at=now() WHERE id=$4 AND (merchant_id=$5 OR EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=orders.id AND oi.merchant_id=$5)) RETURNING *`,[carrier||null,tracking||null,trackingUrl||null,orderId,merchantId]);
  return r.rows[0]??null;
}

export async function getMerchantProfile(pool, merchantId, userId) {
  const merchant=await getMerchantForOwner(pool,merchantId,userId); if(!merchant)return null;
  const r=await pool.query('SELECT id,owner_id,name,slug,shop_slug,email,contact_email,vat_id,logo_url,shop_url,payout_method,payout_email,description,published,created_at,updated_at FROM merchants WHERE id=$1',[merchantId]);
  return r.rows[0]??null;
}
export async function updateMerchantProfile(pool, merchantId, userId, body) {
  if(!await getMerchantForOwner(pool,merchantId,userId))return null;
  const fields=[],values=[]; const add=(k,v)=>{fields.push(k+'=$'+(values.length+1));values.push(v);};
  for(const [key,max] of [['name',200],['contact_email',320],['vat_id',32],['logo_url',2000],['shop_url',2000],['payout_method',80],['payout_email',320],['description',5000]]) if(body?.[key]!==undefined){const v=body[key]==null?'':String(body[key]).trim();if(v.length>max){const e=new Error('invalid_profile');e.status=400;throw e;}if(key==='name'&&!v){const e=new Error('invalid_profile');e.status=400;throw e;}add(key,v);}
  if(body?.shop_slug!==undefined){const v=String(body.shop_slug??'').trim().toLowerCase();if(v.length<3||v.length>63||!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(v)){const e=new Error('invalid_shop_slug');e.status=400;throw e;}const existing=await pool.query('SELECT id FROM merchants WHERE lower(shop_slug)=lower($1) AND id<>$2 LIMIT 1',[v,merchantId]);if(existing.rows[0]){const e=new Error('shop_slug_taken');e.status=409;throw e;}add('shop_slug',v);}
  if(body?.published!==undefined){if(typeof body.published!=='boolean'){const e=new Error('invalid_published');e.status=400;throw e;}add('published',body.published);}
  if(!fields.length)return getMerchantProfile(pool,merchantId,userId);
  values.push(merchantId); const r=await pool.query('UPDATE merchants SET '+fields.join(',')+',updated_at=now() WHERE id=$'+values.length+' RETURNING id,owner_id,name,slug,shop_slug,email,contact_email,vat_id,logo_url,shop_url,payout_method,payout_email,description,published,created_at,updated_at',values); return r.rows[0]??null;
}
export async function getMerchantLegal(pool,merchantId,userId) {
  if(!await getMerchantForOwner(pool,merchantId,userId))return null;
  const r=await pool.query('SELECT * FROM merchant_legal_settings WHERE merchant_id=$1',[merchantId]);
  if(r.rows[0])return r.rows[0];
  const c=await pool.query('INSERT INTO merchant_legal_settings(merchant_id) VALUES($1) RETURNING *',[merchantId]); return c.rows[0];
}
export async function updateMerchantLegal(pool,merchantId,userId,body) {
  if(!await getMerchantForOwner(pool,merchantId,userId))return null; await getMerchantLegal(pool,merchantId,userId);
  const fields=[],values=[]; const add=(k,v)=>{fields.push(k+'=$'+(values.length+1));values.push(v);};
  for(const key of ['impressum','datenschutz','agb','widerruf']) if(body?.[key]!==undefined){const v=String(body[key]??'');if(v.length>50000){const e=new Error('invalid_legal');e.status=400;throw e;}add(key,v);}
  if(!fields.length)return getMerchantLegal(pool,merchantId,userId);
  values.push(merchantId);const r=await pool.query('UPDATE merchant_legal_settings SET '+fields.join(',')+',updated_at=now() WHERE merchant_id=$'+values.length+' RETURNING *',values);return r.rows[0]??null;
}
