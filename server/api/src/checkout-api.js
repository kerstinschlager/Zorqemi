import Stripe from 'stripe';

function money(value) {
  return Math.round(Number(value) * 100);
}

function cleanAddress(address) {
  if (!address || typeof address !== 'object') return null;
  return {
    name: String(address.name || '').trim().slice(0, 120),
    line1: String(address.line1 || '').trim().slice(0, 120),
    line2: String(address.line2 || '').trim().slice(0, 120),
    postal_code: String(address.postal_code || '').trim().slice(0, 20),
    city: String(address.city || '').trim().slice(0, 80),
    country: String(address.country || 'DE').trim().toUpperCase().slice(0, 2)
  };
}

export function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  return key ? new Stripe(key) : null;
}

export async function createCheckoutSession(pool, body) {
  const stripe = getStripe();
  if (!stripe) {
    const error = new Error('stripe_not_configured');
    error.status = 503;
    throw error;
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length || items.length > 100) {
    const error = new Error('invalid_checkout_items');
    error.status = 400;
    throw error;
  }

  const ids = [...new Set(items.map((item) => String(item?.product_id || '')).filter(Boolean))];
  const result = await pool.query(
    `SELECT p.id, p.merchant_id, p.name, p.description, p.price, p.stock, p.active,
            m.name AS merchant_name
       FROM products p
       JOIN merchants m ON m.id = p.merchant_id
      WHERE p.id = ANY($1::uuid[]) AND p.active = true AND m.published = true`,
    [ids]
  );
  const products = new Map(result.rows.map((row) => [String(row.id), row]));

  const normalized = items.map((item) => {
    const product = products.get(String(item.product_id));
    const quantity = Number(item.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || quantity > product.stock) return null;
    return { product, quantity };
  });
  if (normalized.some((item) => !item)) {
    const error = new Error('product_unavailable');
    error.status = 409;
    throw error;
  }

  const merchantIds = [...new Set(normalized.map(({ product }) => String(product.merchant_id)))];
  const subtotal = normalized.reduce((sum, { product, quantity }) => sum + Number(product.price) * quantity, 0);
  const settingsResult = merchantIds.length === 1
    ? await pool.query('SELECT * FROM shop_settings WHERE merchant_id = $1', [merchantIds[0]])
    : { rows: [] };
  const settings = settingsResult.rows[0] || { currency: 'EUR', shipping_flat: 0, free_shipping_from: null, vat_enabled: false, vat_rate: 0 };
  const shipping = settings.free_shipping_from != null && subtotal >= Number(settings.free_shipping_from)
    ? 0 : Number(settings.shipping_flat || 0);
  const tax = settings.vat_enabled ? (subtotal + shipping) * (Number(settings.vat_rate || 0) / 100) : 0;
  const total = subtotal + shipping + tax;

  const checkout = await pool.query(
    `INSERT INTO checkout_sessions
      (merchant_id, status, currency, subtotal, shipping_total, tax_total, total, shipping_address, payment_provider, expires_at)
     VALUES ($1, 'payment_pending', $2, $3, $4, $5, $6, $7, 'stripe', now() + interval '30 minutes')
     RETURNING id`,
    [merchantIds.length === 1 ? merchantIds[0] : null, settings.currency || 'EUR', subtotal, shipping, tax, total, cleanAddress(body?.shipping_address)]
  );
  const checkoutId = String(checkout.rows[0].id);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: normalized.map(({ product, quantity }) => ({
        quantity,
        price_data: {
          currency: String(settings.currency || 'EUR').toLowerCase(),
          unit_amount: money(product.price),
          product_data: {
            name: product.name,
            description: product.description ? String(product.description).slice(0, 500) : undefined
          }
        }
      })),
      shipping_address_collection: { allowed_countries: ['DE', 'AT', 'NL', 'BE', 'FR', 'PL', 'CZ'] },
      customer_email: body?.customer_email ? String(body.customer_email).trim().slice(0, 254) : undefined,
      success_url: body?.success_url || 'https://zorqemishop.de/?checkout=success',
      cancel_url: body?.cancel_url || 'https://zorqemishop.de/?checkout=cancelled',
      metadata: { zorqemi_checkout_id: checkoutId }
    });

    await pool.query(
      `UPDATE checkout_sessions SET payment_reference = $1, updated_at = now() WHERE id = $2`,
      [session.id, checkoutId]
    );
    return { id: checkoutId, url: session.url, stripe_session_id: session.id, total, currency: settings.currency || 'EUR' };
  } catch (error) {
    await pool.query(`UPDATE checkout_sessions SET status = 'cancelled', updated_at = now() WHERE id = $1`, [checkoutId]);
    throw error;
  }
}

export async function handleStripeWebhook(pool, rawBody, signature) {
  const stripe = getStripe();
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!stripe || !secret) {
    const error = new Error('stripe_webhook_not_configured');
    error.status = 503;
    throw error;
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature || '', secret);
  const inserted = await pool.query(
    `INSERT INTO payment_events(provider, event_id, event_type, payload)
     VALUES ('stripe', $1, $2, $3)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING id`,
    [event.id, event.type, event]
  );
  if (!inserted.rowCount) return { received: true, duplicate: true };

  const session = event.data?.object;
  const checkoutId = session?.metadata?.zorqemi_checkout_id;
  if (!checkoutId) return { received: true };

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await pool.query(
      `UPDATE checkout_sessions SET status = 'paid', payment_provider = 'stripe', payment_reference = $1, updated_at = now() WHERE id = $2`,
      [session.id, checkoutId]
    );
  } else if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
    await pool.query(`UPDATE checkout_sessions SET status = 'cancelled', updated_at = now() WHERE id = $1`, [checkoutId]);
  }

  return { received: true };
}
