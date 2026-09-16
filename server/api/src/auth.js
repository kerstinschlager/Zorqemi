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
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltText, hashText] = parts;
    const expected = Buffer.from(hashText, 'base64url');
    const actual = crypto.scryptSync(password, Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p)
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 10 && password.length <= 200;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const item of raw.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
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

export function setMerchantSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  const maxAge = SESSION_DAYS * 86400;
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${maxAge}`);
}

export function clearMerchantSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`);
}

export async function getMerchantFromRequest(pool, req) {
  const bearer = req.get('authorization') || '';
  const cookie = readCookie(req, COOKIE_NAME);
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : cookie;
  if (!/^[a-f0-9]{64}$/i.test(token || '')) return null;
  const result = await pool.query(`
    SELECT u.id AS user_id, u.email, u.role, u.merchant_id, u.active
      FROM merchant_sessions s
      JOIN merchant_users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true
     LIMIT 1`, [hashToken(token)]);
  if (!result.rows[0]) return null;
  await pool.query('UPDATE merchant_sessions SET last_seen_at=now() WHERE token_hash=$1', [hashToken(token)]);
  return result.rows[0];
}

export async function loginMerchant(pool, email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const result = await pool.query(
    `SELECT u.id,u.merchant_id,u.email,u.password_hash,u.role,u.active,m.name AS merchant_name,m.slug,m.shop_slug
       FROM merchant_users u JOIN merchants m ON m.id=u.merchant_id
      WHERE lower(u.email)=$1 AND u.active=true LIMIT 1`,
    [normalizedEmail]
  );
  const user = result.rows[0];
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) return null;
  const token = await createMerchantSession(pool, user.id);
  return { token, user: { id: user.id, merchant_id: user.merchant_id, email: user.email, role: user.role, merchant_name: user.merchant_name, slug: user.slug, shop_slug: user.shop_slug } };
}

export async function registerMerchant(pool, { name, slug, shopSlug, email, password }) {
  const merchantName = String(name || '').trim();
  const merchantSlug = String(slug || shopSlug || '').trim().toLowerCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (merchantName.length < 2 || merchantName.length > 120 || !/^[a-z0-9][a-z0-9-]{2,48}$/.test(merchantSlug) || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || !validatePassword(password)) {
    const error = new Error('invalid_registration'); error.status = 400; throw error;
  }
  const merchantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO merchants(id,owner_id,name,slug,shop_slug,email,published) VALUES($1,$2,$3,$4,$4,$5,false)`, [merchantId, userId, merchantName, merchantSlug, normalizedEmail]);
    await client.query(`INSERT INTO merchant_users(id,merchant_id,email,password_hash,role) VALUES($1,$2,$3,$4,'owner')`, [userId, merchantId, normalizedEmail, passwordHash]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') { error.status = 409; error.message = 'email_or_shop_already_registered'; }
    throw error;
  } finally { client.release(); }
  const token = await createMerchantSession(pool, userId);
  return { token, user: { id: userId, merchant_id: merchantId, email: normalizedEmail, role: 'owner', merchant_name: merchantName, slug: merchantSlug, shop_slug: merchantSlug } };
}

export async function logoutMerchant(pool, req, res) {
  const bearer = req.get('authorization') || '';
  const cookie = readCookie(req, COOKIE_NAME);
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : cookie;
  if (/^[a-f0-9]{64}$/i.test(token || '')) await pool.query('DELETE FROM merchant_sessions WHERE token_hash=$1', [hashToken(token)]);
  clearMerchantSessionCookie(res);
}

export async function requireMerchant(req, res, next) {
  try {
    const user = await getMerchantFromRequest(req.app.locals.pool, req);
    if (!user) return res.status(401).json({ ok: false, error: 'authentication_required' });
    req.merchantUser = user;
    next();
  } catch (err) { next(err); }
}

export function hashMerchantPassword(password) { return hashPassword(password); }
export function verifyMerchantPassword(password, encoded) { return verifyPassword(password, encoded); }

export async function createCustomerSession(pool, customerId) {
  const token = createSessionToken();
  await pool.query(`INSERT INTO customer_sessions (customer_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '${SESSION_DAYS} days')`, [customerId, hashToken(token)]);
  return token;
}

export async function getCustomerFromRequest(pool, req) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const result = await pool.query(`SELECT c.id,c.email,c.first_name,c.last_name FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1`, [hashToken(token)]);
  return result.rows[0] ?? null;
}
