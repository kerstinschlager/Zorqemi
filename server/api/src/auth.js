import crypto from 'node:crypto';

const SESSION_DAYS = 30;
const COOKIE_NAME = 'zq_session';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

function verifyPassword(password, encoded) {
  try {
    const parts = String(encoded || '').split('$');
    if (parts.length !== 7 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltText, hashText] = parts;
    const expected = Buffer.from(hashText, 'base64url');
    const actual = crypto.scryptSync(password, Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p)
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 10 && password.length <= 200;
}

export async function createMerchantSession(pool, userId) {
  const token = createSessionToken();
  await pool.query(
    `INSERT INTO merchant_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [userId, hashToken(token)]
  );
  return token;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const item of raw.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export function setMerchantSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  const maxAge = SESSION_DAYS * 86400;
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${maxAge}`);
}

export function clearMerchantSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`);
}

export async function getMerchantFromRequest(pool, req) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token || token.length < 40) return null;
  const result = await pool.query(`
    SELECT u.id AS user_id, u.email, u.role, u.merchant_id, u.active
      FROM merchant_sessions s
      JOIN merchant_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true
     LIMIT 1`, [hashToken(token)]);
  if (!result.rows[0]) return null;
  await pool.query('UPDATE merchant_sessions SET last_seen_at = now() WHERE token_hash = $1', [hashToken(token)]);
  return result.rows[0];
}

export async function requireMerchant(req, res, next) {
  try {
    const user = await getMerchantFromRequest(req.app.locals.pool, req);
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.merchantUser = user;
    next();
  } catch (err) { next(err); }
}

export function hashMerchantPassword(password) { return hashPassword(password); }
export function verifyMerchantPassword(password, encoded) { return verifyPassword(password, encoded); }

// Existing customer bearer-token support.
export async function createCustomerSession(pool, customerId) {
  const token = createSessionToken();
  await pool.query(
    `INSERT INTO customer_sessions (customer_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [customerId, hashToken(token)]
  );
  return token;
}

export async function getCustomerFromRequest(pool, req) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const result = await pool.query(
    `SELECT c.id, c.email, c.first_name, c.last_name
       FROM customer_sessions s
       JOIN customers c ON c.id = s.customer_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
      LIMIT 1`,
    [hashToken(token)]
  );
  return result.rows[0] ?? null;
}
