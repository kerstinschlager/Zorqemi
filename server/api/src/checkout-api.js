import Stripe from 'stripe';
import crypto from 'node:crypto';

function money(value) {
  return Math.round(Number(value) * 100);
}

const ALLOWED_SHIPPING_COUNTRIES = new Set(['DE', 'AT', 'NL', 'BE', 'FR', 'PL', 'CZ']);

function cleanAddress(address) {
  if (!address || typeof address !== 'object') return null;
  const country = String(address.country || 'DE').trim().toUpperCase().slice(0, 2);
  if (!ALLOWED_SHIPPING_COUNTRIES.has(country)) fail('invalid_shipping_country', 400);
  return {
    name: String(address.name || '').trim().slice(0, 120),
    line1: String(address.line1 || '').trim().slice(0, 120),
    line2: String(address.line2 || '').trim().slice(0, 120),
    postal_code: String(address.postal_code || '').trim().slice(0, 20),
    city: String(address.city || '').trim().slice(0, 80),
    country
  };
}

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function safeCheckoutRedirect(value, fallback) {
  if (!value) return fallback;
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:') return fallback;
    const allowed = String(process.env.ZORQEMI_ALLOWED_CHECKOUT_ORIGINS || 'https://zorqemishop.de,https://www.zorqemishop.de,https://zorqemi.de,https://www.zorqemi.de')
      .split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);
    if (!allowed.includes(url.origin)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function createCheckoutAccessToken() {
  return crypto.randomBytes(32).toString('base64url');
}
function hashCheckoutAccessToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  return key ? new Stripe(key) : null;
}

async function releaseCheckoutStock(pool, checkoutId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await client.query(
      `SELECT product_id,variant_id,quantity
         FROM checkout_stock_reservations
        WHERE checkout_session_id=$1 AND released_at IS NULL AND settled_at IS NULL
        FOR UPDATE`,
      [checkoutId]
    );
    for (const row of rows.rows) {
      if (row.variant_id) {
        await client.query('UPDATE product_variants SET reserved_stock=GREATEST(0,reserved_stock-$1),updated_at=now() WHERE id=$2',[row.quantity,row.variant_id]);
      } else {
        await client.query('UPDATE products SET reserved_stock=GREATEST(0,reserved_stock-$1),updated_at=now() WHERE id=$2',[row.quantity,row.product_id]);
      }
    }
    await client.query(
      `UPDATE checkout_stock_reservations SET released_at=now()
         WHERE checkout_session_id=$1 AND released_at IS NULL AND settled_at IS NULL`,
      [checkoutId]
    );
    await client.query(`UPDATE checkout_sessions SET status='cancelled',updated_at=now() WHERE id=$1 AND status<>'paid'`,[checkoutId]);
    await client.query('COMMIT');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function releaseExpiredCheckoutReservations(pool) {
  const client = await pool.connect();
  let released = 0;
  try {
    await client.query('BEGIN');
    const checkouts = await client.query(
      `SELECT id
         FROM checkout_sessions
        WHERE status='payment_pending'
          AND expires_at IS NOT NULL
          AND expires_at <= now()
        FOR UPDATE SKIP LOCKED
        LIMIT 100`
    );
    for (const checkout of checkouts.rows) {
      const reservations = await client.query(
        `SELECT product_id,variant_id,quantity
           FROM checkout_stock_reservations
          WHERE checkout_session_id=$1
            AND released_at IS NULL
            AND settled_at IS NULL
          FOR UPDATE`,
        [checkout.id]
      );
      for (const row of reservations.rows) {
        if (row.variant_id) {
          await client.query(
            'UPDATE product_variants SET stock=stock+$1,updated_at=now() WHERE id=$2',
            [row.quantity,row.variant_id]
          );
        } else {
          await client.query(
            'UPDATE products SET stock=stock+$1,updated_at=now() WHERE id=$2',
            [row.quantity,row.product_id]
          );
        }
      }
      await client.query(
        `UPDATE checkout_stock_reservations
            SET released_at=now()
          WHERE checkout_session_id=$1
            AND released_at IS NULL
            AND settled_at IS NULL`,
        [checkout.id]
      );
      await client.query(
        `UPDATE checkout_sessions
            SET status='expired',updated_at=now()
          WHERE id=$1 AND status='payment_pending'`,
        [checkout.id]
      );
      released += reservations.rowCount;
    }
    await client.query('COMMIT');
    return { checkouts: checkouts.rowCount, reservations: released };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createCheckoutSession(pool, body, authenticatedCustomer = null) {
  const stripe = getStripe();
  if (!stripe) fail('stripe_not_configured', 503);

  const idempotencyKey = String(body?.idempotency_key || '').trim();
  if (!/^[A-Za-z0-9._:-]{16,100}$/.test(idempotencyKey)) fail('invalid_idempotency_key',400);
  const existing = await pool.query(
    `SELECT id,status,total,currency,payment_reference,expires_at,checkout_access_token_hash
       FROM checkout_sessions
      WHERE idempotency_key=$1
      LIMIT 1`,
    [idempotencyKey]
  );
  if (existing.rowCount) {
    const row=existing.rows[0];
    if (row.payment_reference && row.status==='payment_pending') {
      try {
        const existingStripe=await stripe.checkout.sessions.retrieve(row.payment_reference);
        return { id:String(row.id), url:existingStripe.url, stripe_session_id:row.payment_reference, total:Number(row.total), currency:row.currency, checkout_access_token: null };
      } catch {}
    }
    if (row.status==='paid') return { id:String(row.id), url:null, stripe_session_id:row.payment_reference, total:Number(row.total), currency:row.currency, checkout_access_token: null };
    fail('checkout_request_already_exists',409);
  }
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length || items.length > 100) fail('invalid_checkout_items', 400);

  const ids = [...new Set(items.map((item) => String(item?.product_id || '')).filter(Boolean))];
  const result = await pool.query(
    `SELECT p.id, p.merchant_id, p.name, p.description, p.price, p.stock, p.active,
            v.id AS variant_id, v.name AS variant_name, v.price AS variant_price, v.stock AS variant_stock, v.active AS variant_active
       FROM products p JOIN merchants m ON m.id = p.merchant_id
       LEFT JOIN product_variants v ON v.product_id=p.id
      WHERE p.id = ANY($1::uuid[]) AND p.active = true AND m.published = true`,
    [ids]
  );
  const productRows = new Map();
  for (const row of result.rows) {
    const key=String(row.id);
    if(!productRows.has(key))productRows.set(key,{product:row,variants:new Map()});
    if(row.variant_id)productRows.get(key).variants.set(String(row.variant_id),row);
  }
  const normalized = items.map((item) => {
    const group=productRows.get(String(item.product_id));
    const variantId=item?.variant_id?String(item.variant_id):'';
    const variant=variantId?group?.variants.get(variantId):null;
    const product=group?.product;
    const quantity=Number(item.quantity);
    const stock=variant?Number(variant.variant_stock):Number(product?.stock);
    const price=variant && variant.variant_price !== null ? Number(variant.variant_price) : Number(product?.price);
    if (!product || (variantId && (!variant || variant.variant_active!==true)) || !Number.isInteger(quantity) || quantity<1 || quantity>99 || quantity>stock || !Number.isFinite(price) || price<0) return null;
    return { product, variant:variant||null, quantity, stock, price };
  });
  if (normalized.some((item) => !item)) fail('product_unavailable', 409);

  const merchantIds = [...new Set(normalized.map(({ product }) => String(product.merchant_id)))];
  const settingsResult = await pool.query(
    `SELECT merchant_id, currency, shipping_flat, free_shipping_from, vat_enabled, vat_rate, checkout_enabled
       FROM shop_settings
      WHERE merchant_id = ANY($1::uuid[])`,
    [merchantIds]
  );
  const settingsByMerchant = new Map(settingsResult.rows.map((row) => [String(row.merchant_id), row]));
  const groups = new Map();

  for (const entry of normalized) {
    const merchantId = String(entry.product.merchant_id);
    if (!groups.has(merchantId)) groups.set(merchantId, []);
    groups.get(merchantId).push(entry);
  }

  const merchantTotals = [];
  let currency = null;
  for (const [merchantId, group] of groups) {
    const settings = settingsByMerchant.get(merchantId) || {
      currency: 'EUR', shipping_flat: 0, free_shipping_from: null, vat_enabled: true, vat_rate: 19, checkout_enabled: true
    };
    if (settings.checkout_enabled === false) fail('checkout_disabled', 409);
    const merchantCurrency = String(settings.currency || 'EUR').toUpperCase();
    if (!currency) currency = merchantCurrency;
    if (merchantCurrency !== currency) fail('multi_currency_checkout_unsupported', 409);

    const subtotal = group.reduce((sum, { price, quantity }) => sum + Number(price) * quantity, 0);
    const shipping = settings.free_shipping_from != null && subtotal >= Number(settings.free_shipping_from)
      ? 0 : Number(settings.shipping_flat || 0);
    const tax = settings.vat_enabled ? (subtotal + shipping) * (Number(settings.vat_rate || 0) / 100) : 0;
    merchantTotals.push({ merchantId, currency, subtotal, shipping, tax, total: subtotal + shipping + tax });
  }

  const subtotal = merchantTotals.reduce((sum, item) => sum + item.subtotal, 0);
  const shipping = merchantTotals.reduce((sum, item) => sum + item.shipping, 0);
  const tax = merchantTotals.reduce((sum, item) => sum + item.tax, 0);
  const total = merchantTotals.reduce((sum, item) => sum + item.total, 0);
  const shippingAddress = cleanAddress(body?.shipping_address);
  let customerEmail = String(body?.customer_email || '').trim().toLowerCase();
  let customerId = null;
  if (authenticatedCustomer?.id) {
    const customerResult = await pool.query(
      'SELECT id,email FROM customers WHERE id=$1 LIMIT 1',
      [authenticatedCustomer.id]
    );
    if (!customerResult.rowCount) fail('customer_not_found', 401);
    customerId = customerResult.rows[0].id;
    customerEmail = String(customerResult.rows[0].email || '').trim().toLowerCase();
  } else {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || customerEmail.length > 254) fail('invalid_customer_email', 400);
    const customerResult = await pool.query(
      'INSERT INTO customers(email) VALUES($1) ON CONFLICT (lower(email)) DO UPDATE SET updated_at=now() RETURNING id',
      [customerEmail]
    );
    customerId = customerResult.rows[0]?.id;
  }
  if (!customerId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) fail('customer_unavailable', 500);

  const checkoutAccessToken = createCheckoutAccessToken();
  const checkoutAccessTokenHash = hashCheckoutAccessToken(checkoutAccessToken);
  let checkout;
  try {
    checkout = await pool.query(
      `INSERT INTO checkout_sessions (merchant_id,customer_id,status,currency,subtotal,shipping_total,tax_total,total,shipping_address,payment_provider,expires_at,idempotency_key,checkout_access_token_hash)
       VALUES ($1,$2,'payment_pending',$3,$4,$5,$6,$7,$8,'stripe',now()+interval '30 minutes',$9,$10) RETURNING id`,
      [merchantIds.length === 1 ? merchantIds[0] : null, customerId, currency || 'EUR', subtotal, shipping, tax, total, shippingAddress, idempotencyKey, checkoutAccessTokenHash]
    );
  } catch (error) {
    if (error?.code === '23505') fail('checkout_request_already_exists',409);
    throw error;
  }
  const checkoutId = String(checkout.rows[0].id);

  const itemParams = [checkoutId];
  const values = normalized.map((entry, index) => {
    const { product, variant, quantity, price } = entry;
    const base = index * 7 + 2;
    itemParams.push(product.id, variant?.variant_id || null, product.merchant_id, variant ? product.name+' – '+variant.variant_name : product.name, quantity, price, Number(price) * quantity);
    return `($1,${base},${base + 1},${base + 2},${base + 3},${base + 4},${base + 5},${base + 6})`;
  });
  await pool.query(
    `INSERT INTO checkout_items(checkout_session_id,product_id,variant_id,merchant_id,product_name,quantity,unit_price,total) VALUES ${values.join(',')}`,
    itemParams
  );

  const merchantParams = [];
  const merchantValues = merchantTotals.map((item, index) => {
    const base = index * 6 + 2;
    merchantParams.push(item.merchantId, item.currency, item.subtotal, item.shipping, item.tax, item.total);
    return `($1,$${base},$${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`;
  });
  await pool.query(
    `INSERT INTO checkout_merchant_totals(checkout_session_id,merchant_id,currency,subtotal,shipping_total,tax_total,total) VALUES ${merchantValues.join(',')}`,
    [checkoutId, ...merchantParams]
  );

  const reservationClient = await pool.connect();
  try {
    await reservationClient.query('BEGIN');
    for (const entry of normalized) {
      const productId=entry.product.id;
      const variantId=entry.variant?.variant_id || null;
      const stockResult = variantId
        ? await reservationClient.query(
            `UPDATE product_variants SET reserved_stock=reserved_stock+$1,updated_at=now()
               WHERE id=$2 AND active=true AND stock-reserved_stock >= $1 RETURNING id`,
            [entry.quantity,variantId])
        : await reservationClient.query(
            `UPDATE products SET reserved_stock=reserved_stock+$1,updated_at=now()
               WHERE id=$2 AND active=true AND stock-reserved_stock >= $1 RETURNING id`,
            [entry.quantity,productId]);
      if (!stockResult.rowCount) fail('stock_unavailable',409);
      await reservationClient.query(
        `INSERT INTO checkout_stock_reservations(checkout_session_id,product_id,variant_id,quantity)
         VALUES($1,$2,$3,$4)`,
        [checkoutId,productId,variantId,entry.quantity]
      );
    }
    await reservationClient.query('COMMIT');
  } catch(error) {
    await reservationClient.query('ROLLBACK');
    await pool.query(`UPDATE checkout_sessions SET status='cancelled',updated_at=now() WHERE id=$1`,[checkoutId]);
    throw error;
  } finally {
    try { reservationClient.release(); } catch {}
  }

  try {
    const lineItems = normalized.map(({ product, quantity, price, variant }) => ({
      quantity,
      price_data: {
        currency: String(currency || 'EUR').toLowerCase(),
        unit_amount: money(price),
        product_data: {
          name: variant ? product.name+' – '+variant.variant_name : product.name,
          description: product.description ? String(product.description).slice(0, 500) : undefined
        }
      }
    }));
    if (shipping > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: String(currency || 'EUR').toLowerCase(),
          unit_amount: money(shipping),
          product_data: { name: 'Versandkosten' }
        }
      });
    }
    if (tax > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: String(currency || 'EUR').toLowerCase(),
          unit_amount: money(tax),
          product_data: { name: 'MwSt.' }
        }
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: [...ALLOWED_SHIPPING_COUNTRIES] },
      customer_email: customerEmail,
      success_url: safeCheckoutRedirect(body?.success_url, 'https://zorqemishop.de/?payment=success&session_id={CHECKOUT_SESSION_ID}'),
      cancel_url: safeCheckoutRedirect(body?.cancel_url, 'https://zorqemishop.de/?payment=cancelled'),
      metadata: { zorqemi_checkout_id: checkoutId }
    });
    await pool.query('UPDATE checkout_sessions SET payment_reference=$1,updated_at=now() WHERE id=$2', [session.id, checkoutId]);
    return { id: checkoutId, url: session.url, stripe_session_id: session.id, total, currency: currency || 'EUR', checkout_access_token: checkoutAccessToken };
  } catch (error) {
    await releaseCheckoutStock(pool, checkoutId);
    throw error;
  }
}

export async function handleStripeWebhook(pool, rawBody, signature) {
  const stripe = getStripe();
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!stripe || !secret) fail('stripe_webhook_not_configured', 503);

  const event = stripe.webhooks.constructEvent(rawBody, signature || '', secret);
  const session = event.data?.object;
  const checkoutId = session?.metadata?.zorqemi_checkout_id;
  if (!checkoutId && event.type !== 'charge.refunded') return { received: true };

  const isPaid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  const isCancelled = event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired';
  const isRefunded = event.type === 'charge.refunded';
  if (!isPaid && !isCancelled && !isRefunded) return { received: true };

  if (isRefunded) {
    const paymentIntent = typeof session?.payment_intent === 'string' ? session.payment_intent : null;
    if (!paymentIntent) return { received: true };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO payment_events(provider,event_id,event_type,payload) VALUES ('stripe',$1,$2,$3)
         ON CONFLICT (provider,event_id) DO NOTHING RETURNING id`,
        [event.id, event.type, event]
      );
      if (!inserted.rowCount) { await client.query('COMMIT'); return { received: true, duplicate: true }; }
      const result = await client.query(
        `UPDATE orders SET status='refunded',updated_at=now()
           WHERE stripe_payment_intent_id=$1 AND status <> 'refunded'
           RETURNING id`,
        [paymentIntent]
      );
      await client.query('COMMIT');
      return { received: true, refunded_orders: result.rowCount };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO payment_events(provider,event_id,event_type,payload) VALUES ('stripe',$1,$2,$3)
       ON CONFLICT (provider,event_id) DO NOTHING RETURNING id`,
      [event.id, event.type, event]
    );
    if (!inserted.rowCount) {
      await client.query('COMMIT');
      return { received: true, duplicate: true };
    }

    const checkoutResult = await client.query('SELECT * FROM checkout_sessions WHERE id=$1 FOR UPDATE', [checkoutId]);
    if (!checkoutResult.rowCount) {
      await client.query('COMMIT');
      return { received: true };
    }
    const checkout = checkoutResult.rows[0];

    if (isCancelled) {
      if (checkout.status !== 'paid') {
        const reservations = await client.query(
          `SELECT product_id,variant_id,quantity FROM checkout_stock_reservations
             WHERE checkout_session_id=$1 AND released_at IS NULL AND settled_at IS NULL
             FOR UPDATE`,
          [checkoutId]
        );
        for (const row of reservations.rows) {
          if (row.variant_id) await client.query('UPDATE product_variants SET stock=stock+$1,updated_at=now() WHERE id=$2',[row.quantity,row.variant_id]);
          else await client.query('UPDATE products SET stock=stock+$1,updated_at=now() WHERE id=$2',[row.quantity,row.product_id]);
        }
        await client.query(
          `UPDATE checkout_stock_reservations SET released_at=now()
             WHERE checkout_session_id=$1 AND released_at IS NULL AND settled_at IS NULL`,
          [checkoutId]
        );
        await client.query(`UPDATE checkout_sessions SET status='cancelled',updated_at=now() WHERE id=$1`, [checkoutId]);
      }
      await client.query('COMMIT');
      return { received: true };
    }

    if (checkout.status === 'paid') {
      await client.query('COMMIT');
      return { received: true, already_paid: true };
    }

    const expectedAmount = money(checkout.total);
    const receivedAmount = Number(session.amount_total);
    const receivedCurrency = String(session.currency || '').toUpperCase();
    if (!Number.isFinite(receivedAmount) || receivedAmount !== expectedAmount || receivedCurrency !== String(checkout.currency || 'EUR').toUpperCase()) {
      throw Object.assign(new Error('payment_amount_mismatch'), { status: 400 });
    }

    // Stripe is authoritative for the shipping address because Checkout collects it directly.
    const shippingDetails = session.shipping_details;
    const stripeAddress = shippingDetails?.address;
    const stripeShippingAddress = stripeAddress ? cleanAddress({
      name: shippingDetails?.name || session.customer_details?.name || '',
      line1: stripeAddress.line1 || '',
      line2: stripeAddress.line2 || '',
      postal_code: stripeAddress.postal_code || '',
      city: stripeAddress.city || '',
      country: stripeAddress.country || 'DE'
    }) : null;
    if (stripeShippingAddress) {
      await client.query(
        'UPDATE checkout_sessions SET shipping_address=$1,updated_at=now() WHERE id=$2',
        [stripeShippingAddress, checkoutId]
      );
      checkout.shipping_address = stripeShippingAddress;
    }

    const items = await client.query(
      'SELECT * FROM checkout_items WHERE checkout_session_id=$1 ORDER BY created_at',
      [checkoutId]
    );
    if (!items.rowCount) throw new Error('checkout_items_missing');

    const totals = await client.query(
      'SELECT * FROM checkout_merchant_totals WHERE checkout_session_id=$1 ORDER BY merchant_id',
      [checkoutId]
    );
    if (!totals.rowCount) throw new Error('checkout_merchant_totals_missing');

    const reservationCheck = await client.query(
      `SELECT count(*)::int AS count FROM checkout_stock_reservations
         WHERE checkout_session_id=$1 AND released_at IS NULL AND settled_at IS NULL`,
      [checkoutId]
    );
    if (Number(reservationCheck.rows[0]?.count || 0) !== items.rowCount) throw new Error('stock_reservation_missing');

    for (const merchantTotal of totals.rows) {
      const order = await client.query(
        `INSERT INTO orders(merchant_id,customer_id,status,currency,subtotal,shipping_total,tax_total,total,shipping_address,payment_provider,payment_reference,stripe_payment_intent_id)
         VALUES($1,$2,'paid',$3,$4,$5,$6,$7,$8,'stripe',$9,$10) RETURNING id`,
        [merchantTotal.merchant_id, checkout.customer_id, merchantTotal.currency, merchantTotal.subtotal, merchantTotal.shipping_total, merchantTotal.tax_total, merchantTotal.total, checkout.shipping_address, session.id, typeof session.payment_intent === 'string' ? session.payment_intent : null]
      );
      const merchantItems = items.rows.filter((item) => String(item.merchant_id) === String(merchantTotal.merchant_id));
      for (const item of merchantItems) {
        await client.query(
          `INSERT INTO order_items(order_id,product_id,variant_id,merchant_id,product_name,quantity,unit_price,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [order.rows[0].id, item.product_id, item.variant_id, item.merchant_id, item.product_name, item.quantity, item.unit_price, item.total]
        );
      }
    }

    await client.query(
      `UPDATE checkout_stock_reservations SET settled_at=now()
         WHERE checkout_session_id=$1 AND released_at IS NULL AND settled_at IS NULL`,
      [checkoutId]
    );
    await client.query(
      `UPDATE checkout_sessions SET status='paid',payment_provider='stripe',payment_reference=$1,updated_at=now() WHERE id=$2`,
      [session.id, checkoutId]
    );
    await client.query('COMMIT');
    return { received: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
