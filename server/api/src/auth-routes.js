import { createMerchantSession, clearMerchantSessionCookie, getMerchantFromRequest, hashMerchantPassword, setMerchantSessionCookie, validatePassword, verifyMerchantPassword } from './auth.js';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registerAuthRoutes(app, pool) {
  app.post('/api/v1/auth/login', async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!emailRe.test(email) || password.length === 0) return res.status(400).json({ ok: false, error: 'invalid_credentials' });
      const { rows } = await pool.query(`
        SELECT u.id, u.email, u.password_hash, u.role, u.merchant_id, u.active, m.name AS merchant_name, m.published
        FROM merchant_users u JOIN merchants m ON m.id=u.merchant_id
        WHERE lower(u.email)=$1 LIMIT 1`, [email]);
      const user = rows[0];
      if (!user || !user.active || !verifyMerchantPassword(password, user.password_hash)) {
        return res.status(401).json({ ok: false, error: 'invalid_credentials' });
      }
      const token = await createMerchantSession(pool, user.id);
      setMerchantSessionCookie(res, token);
      res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role, merchant_id: user.merchant_id, merchant_name: user.merchant_name, published: user.published } });
    } catch (e) { next(e); }
  });

  app.post('/api/v1/auth/logout', async (req, res, next) => {
    try {
      const user = await getMerchantFromRequest(pool, req);
      if (user) {
        const token = req.headers.cookie?.match(/(?:^|;\s*)zq_session=([^;]+)/)?.[1];
        if (token) {
          const crypto = await import('node:crypto');
          const hash = crypto.createHash('sha256').update(decodeURIComponent(token)).digest('hex');
          await pool.query('DELETE FROM merchant_sessions WHERE token_hash=$1', [hash]);
        }
      }
      clearMerchantSessionCookie(res);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  app.get('/api/v1/auth/me', async (req, res, next) => {
    try {
      const user = await getMerchantFromRequest(pool, req);
      if (!user) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
      const merchant = await pool.query('SELECT id,name,slug,shop_slug,email,published FROM merchants WHERE id=$1', [user.merchant_id]);
      res.json({ ok: true, user, merchant: merchant.rows[0] || null });
    } catch (e) { next(e); }
  });

  // Account creation is intentionally disabled unless explicitly enabled for a deployment.
  app.post('/api/v1/auth/register', async (req, res, next) => {
    try {
      if (process.env.ALLOW_MERCHANT_REGISTRATION !== 'true') return res.status(403).json({ ok: false, error: 'registration_disabled' });
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const name = String(req.body?.merchant_name || '').trim();
      const slug = String(req.body?.shop_slug || '').trim().toLowerCase();
      if (!emailRe.test(email) || !validatePassword(password) || !name || !/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/.test(slug)) {
        return res.status(400).json({ ok: false, error: 'invalid_registration' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const exists = await client.query('SELECT 1 FROM merchant_users WHERE lower(email)=$1', [email]);
        if (exists.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ ok: false, error: 'email_in_use' }); }
        const merchant = await client.query('INSERT INTO merchants(owner_id,name,slug,shop_slug,email) VALUES(gen_random_uuid(),$1,$2,$2,$3) RETURNING id,name,slug,shop_slug,email,published', [name, slug, email]);
        const m = merchant.rows[0];
        await client.query('UPDATE merchants SET owner_id=$1 WHERE id=$2', [m.id, m.id]);
        const user = await client.query('INSERT INTO merchant_users(merchant_id,email,password_hash,role) VALUES($1,$2,$3,\'owner\') RETURNING id,email,role,merchant_id', [m.id, email, hashMerchantPassword(password)]);
        await client.query('INSERT INTO shop_settings(merchant_id) VALUES($1) ON CONFLICT DO NOTHING', [m.id]);
        await client.query('COMMIT');
        const token = await createMerchantSession(pool, user.rows[0].id);
        setMerchantSessionCookie(res, token);
        res.status(201).json({ ok: true, user: user.rows[0], merchant: m });
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (e) { next(e); }
  });
}
