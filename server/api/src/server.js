import express from 'express';
import pg from 'pg';
import { migrate } from './migrate.js';
import { resolveShopByHost, getPublicShop } from './shop-router.js';

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
    const result = await pool.query(
      'select version from schema_migrations order by version desc limit 1'
    );
    res.json({
      ok: true,
      version: '0.1.0',
      migration: result.rows[0]?.version ?? null,
      database: 'postgresql'
    });
  } catch (error) {
    console.error('status database error', error);
    res.status(503).json({ ok: false, version: '0.1.0', migration: 'database-unavailable' });
  }
});

// Public storefront resolution. The Host header selects the published merchant shop.
app.get('/api/v1/shop', async (req, res, next) => {
  try {
    const shop = await resolveShopByHost(pool, req.get('host'));
    if (!shop) return res.status(404).json({ ok: false, error: 'shop_not_found' });
    return res.json({ ok: true, shop });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/v1/shop/:merchantId', async (req, res, next) => {
  try {
    const shop = await getPublicShop(pool, req.params.merchantId);
    if (!shop) return res.status(404).json({ ok: false, error: 'shop_not_found' });
    return res.json({ ok: true, shop });
  } catch (error) {
    return next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'not_found' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: 'internal_server_error' });
});

try {
  await migrate(pool);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Zorqemi API listening on ${port}`);
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  console.error('Database migration failed:', error);
  await pool.end();
  process.exit(1);
}
