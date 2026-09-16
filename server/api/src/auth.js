import crypto from 'node:crypto';

const SESSION_DAYS = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createCustomerSession(pool, customerId) {
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  await pool.query(
    `INSERT INTO customer_sessions (customer_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [customerId, tokenHash]
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
