import express from 'express';
import pg from 'pg';
import { migrate } from './migrate.js';
import { resolveShopByHost, getPublicShop } from './shop-router.js';
import { getMerchantForOwner, listMerchantProducts, createMerchantProduct, updateMerchantProduct, getMerchantOrders, updateMerchantOrder, getShopSettings, updateShopSettings } from './merchant-api.js';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', async (_req, res) => {
  try {
    const result = await pool.query('select current_timestamp as now');
    res.json({ ok: true, service: 'zorqemi-api', database: 'ok', time: result.rows[0].now });
  } catch (error) {
    console.error('healthz database error', error);
    res.status(503).json({ ok: false, service: 'zorqemi-api', database: 'unavailable' });
  }
});

app.get('/api/v1/status', async (_req, res) => {
  try {
    const result = await pool.query('select version from schema_migrations order by version desc limit 1');
    res.json({ ok: true, version: '0.2.0', migration: result.rows[0]?.version ?? null, database: 'postgresql' });
  } catch (error) {
    console.error('status database error', error);
    res.status(503).json({ ok: false, version: '0.2.0', migration: 'database-unavailable' });
  }
});

// Temporary owner authentication bridge. Until the frontend is migrated to self-hosted auth,
// the connected Supabase user id can be supplied as a trusted server-side header only when
// ZORQEMI_TRUSTED_OWNER_HEADER is explicitly enabled by the deployment.
function ownerFromRequest(req) {
  const headerName = process.env.ZORQEMI_TRUSTED_OWNER_HEADER;
  if (!headerName) return null;
  const value = req.get(headerName);
  return /^[0-9a-f-]{36}$/i.test(value || '') ? value : null;
}

async function requireOwner(req, res) {
  const ownerId = ownerFromRequest(req);
  if (!ownerId) { res.status(401).json({ ok: false, error: 'authentication_required' }); return null; }
  return ownerId;
}

// Merchant API: intentionally owner-scoped; no public merchant writes.
app.get('/api/v1/merchant/:merchantId', async (req, res, next) => {
  try {
    const ownerId = await requireOwner(req, res); if (!ownerId) return;
    const merchant = await getMerchantForOwner(pool, req.params.merchantId, ownerId);
    if (!merchant) return res.status(404).json({ ok: false, error: 'merchant_not_found' });
    res.json({ ok: true, merchant });
  } catch (e) { next(e); }
});

app.get('/api/v1/merchant/:merchantId/products', async (req, res, next) => {
  try {
    const ownerId = await requireOwner(req, res); if (!ownerId) return;
    const data = await listMerchantProducts(pool, req.params.merchantId, ownerId);
    if (!data) return res.status(404).json({ ok: false, error: 'merchant_not_found' });
    res.json({ ok: true, ...data });
  } catch (e) { next(e); }
});

app.post('/api/v1/merchant/:merchantId/products', async (req, res, next) => {
  try {
    const ownerId = await requireOwner(req, res); if (!ownerId) return;
    const product = await createMerchantProduct(pool, req.params.merchantId, ownerId, req.body);
    if (!product) return res.status(404).json({ ok: false, error: 'merchant_not_found' });
    res.status(201).json({ ok: true, product });
  } catch (e) { next(e); }
});

app.patch('/api/v1/merchant/:merchantId/products/:productId', async (req, res, next) => {
  try {
    const ownerId = await requireOwner(req, res); if (!ownerId) return;
    const product = await updateMerchantProduct(pool, req.params.merchantId, ownerId, req.params.productId, req.body);
    if (!product) return res.status(404).json({ ok: false, error: 'product_not_found' });
    res.json({ ok: true, product });
  } catch (e) { next(e); }
});

app.get('/api/v1/merchant/:merchantId/orders', async (req, res, next) => {
  try {
    const ownerId = await requireOwner(req, res); if (!ownerId) return;
    const orders = await getMerchantOrders(pool, req.params.merchantId, ownerId, req.query.limit);
    if (!orders) return res.status(404).json({ ok: false, error: 'merchant_not_found' });
    res.json({ ok: true, orders });
  } catch (e) { next(e); }
});

app.patch('/api/v1/merchant/:merchantId/orders/:orderId', async (req, res, next) => {
  try {
    const ownerId = await requireOwner(req, res); if (!ownerId) return;
    const order = await updateMerchantOrder(pool, req.params.merchantId, ownerId, req.params.orderId, String(req.body?.status || ''));
    if (!order) return res.status(404).json({ ok: false, error: 'order_not_found_or_locked' });
    res.json({ ok: true, order });
  } catch (e) { next(e); }
});

app.get('/api/v1/merchant/:merchantId/settings', async (req, res, next) => {
  try {
    const ownerId = await requireOwner(req, res); if (!ownerId) return;
    const settings = await getShopSettings(pool, req.params.merchantId, ownerId);
    if (!settings) return res.status(404).json({ ok: false, error: 'merchant_not_found' });
    res.json({ ok: true, settings });
  } catch (e) { next(e); }
});

app.patch('/api/v1/merchant/:merchantId/settings', async (req, res, next) => {
  try {
    const ownerId = await requireOwner(req, res); if (!ownerId) return;
    const settings = await updateShopSettings(pool, req.params.merchantId, ownerId, req.body);
    if (!settings) return res.status(404).json({ ok: false, error: 'merchant_not_found' });
    res.json({ ok: true, settings });
  } catch (e) { next(e); }
});

// Public storefront resolution. The Host header selects the published merchant shop.
app.get('/api/v1/shop', async (req, res, next) => {
  try {
    const shop = await resolveShopByHost(pool, req.get('host'));
    if (!shop) return res.status(404).json({ ok: false, error: 'shop_not_found' });
    res.json({ ok: true, shop });
  } catch (e) { next(e); }
});

app.get('/api/v1/shop/products', async (req, res, next) => {
  try {
    const shop = await resolveShopByHost(pool, req.get('host'));
    if (!shop) return res.status(404).json({ ok: false, error: 'shop_not_found' });
    const result = await pool.query(`SELECT p.id,p.name,p.description,p.price,p.stock,p.active,p.source_provider,p.source_product_id,p.created_at,
      COALESCE(json_agg(json_build_object('id',v.id,'name',v.name,'sku',v.sku,'price',v.price,'stock',v.stock,'active',v.active,'source_variant_id',v.source_variant_id) ORDER BY v.created_at) FILTER (WHERE v.id IS NOT NULL),'[]'::json) variants
      FROM products p LEFT JOIN product_variants v ON v.product_id=p.id WHERE p.merchant_id=$1 AND p.active=true GROUP BY p.id ORDER BY p.created_at DESC`, [shop.id]);
    res.json({ ok: true, shop, products: result.rows });
  } catch (e) { next(e); }
});

app.get('/api/v1/shop/:merchantId', async (req, res, next) => {
  try {
    const shop = await getPublicShop(pool, req.params.merchantId);
    if (!shop) return res.status(404).json({ ok: false, error: 'shop_not_found' });
    res.json({ ok: true, shop });
  } catch (e) { next(e); }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number(error?.status) || 500;
  res.status(status).json({ ok: false, error: status < 500 ? error.message : 'internal_server_error' });
});

try {
  await migrate(pool);
  const server = app.listen(port, '0.0.0.0', () => console.log(`Zorqemi API listening on ${port}`));
  const shutdown = async (signal) => { console.log(`Received ${signal}, shutting down`); server.close(async () => { await pool.end(); process.exit(0); }); };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  console.error('Database migration failed:', error);
  await pool.end();
  process.exit(1);
}
