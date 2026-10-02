import crypto from 'node:crypto';

const SESSION_DAYS = 30;
const COOKIE_NAME = 'zq_session';

function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
export function createSessionToken() { return crypto.randomBytes(32).toString('hex'); }

function hashPassword(password) { const salt=crypto.randomBytes(16); const derived=crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1}); return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`; }
function verifyPassword(password,encoded) { try { const parts=String(encoded||'').split('$'); if(parts.length!==6||parts[0]!=='scrypt')return false; const [,n,r,p,saltText,hashText]=parts; const expected=Buffer.from(hashText,'base64url'); const actual=crypto.scryptSync(password,Buffer.from(saltText,'base64url'),expected.length,{N:Number(n),r:Number(r),p:Number(p)}); return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected); } catch{return false;} }
export function validatePassword(password) { return typeof password==='string'&&password.length>=10&&password.length<=200; }
function readCookie(req,name) { for(const item of (req.headers.cookie||'').split(';')) { const [key,...value]=item.trim().split('='); if(key===name)return decodeURIComponent(value.join('=')); } return null; }
function requestToken(req) { const bearer=req.get('authorization')||''; return bearer.startsWith('Bearer ')?bearer.slice(7).trim():readCookie(req,COOKIE_NAME); }

export async function createMerchantSession(pool,userId) { const token=createSessionToken(); await pool.query(`INSERT INTO merchant_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '${SESSION_DAYS} days')`,[userId,hashToken(token)]); return token; }
export function setMerchantSessionCookie(res,token) { const secure=process.env.NODE_ENV==='production'; res.setHeader('Set-Cookie',`${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure?'; Secure':''}; Max-Age=${SESSION_DAYS*86400}`); }
export function clearMerchantSessionCookie(res) { const secure=process.env.NODE_ENV==='production'; res.setHeader('Set-Cookie',`${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure?'; Secure':''}; Max-Age=0`); }

export async function getMerchantFromRequest(pool,req) { const token=requestToken(req); if(!/^[a-f0-9]{64}$/i.test(token||''))return null; const result=await pool.query(`SELECT u.id AS user_id,u.email,u.role,u.merchant_id,u.active FROM merchant_sessions s JOIN merchant_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true LIMIT 1`,[hashToken(token)]); if(!result.rows[0])return null; await pool.query('UPDATE merchant_sessions SET last_seen_at=now() WHERE token_hash=$1',[hashToken(token)]); return result.rows[0]; }

export async function loginMerchant(pool,email,password) { const normalized=String(email||'').trim().toLowerCase(); const r=await pool.query(`SELECT u.id,u.merchant_id,u.email,u.password_hash,u.role,u.active,m.name AS merchant_name,m.slug,m.shop_slug FROM merchant_users u JOIN merchants m ON m.id=u.merchant_id WHERE lower(u.email)=$1 AND u.active=true LIMIT 1`,[normalized]); const u=r.rows[0]; if(!u||!verifyPassword(String(password||''),u.password_hash))return null; const token=await createMerchantSession(pool,u.id); return {token,user:{id:u.id,merchant_id:u.merchant_id,email:u.email,role:u.role,merchant_name:u.merchant_name,slug:u.slug,shop_slug:u.shop_slug}}; }

export async function registerMerchant(pool,{name,slug,shopSlug,email,password}) { const merchantName=String(name||'').trim(), merchantSlug=String(slug||shopSlug||'').trim().toLowerCase(), normalized=String(email||'').trim().toLowerCase(); if(merchantName.length<2||merchantName.length>120||!/^[a-z0-9][a-z0-9-]{2,48}$/.test(merchantSlug)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)||!validatePassword(password)){const e=new Error('invalid_registration');e.status=400;throw e;} const merchantId=crypto.randomUUID(),userId=crypto.randomUUID(),passwordHash=hashPassword(password),client=await pool.connect(); try{await client.query('BEGIN'); await client.query(`INSERT INTO merchants(id,owner_id,name,slug,shop_slug,email,published) VALUES($1,$2,$3,$4,$4,$5,false)`,[merchantId,userId,merchantName,merchantSlug,normalized]); await client.query(`INSERT INTO merchant_users(id,merchant_id,email,password_hash,role) VALUES($1,$2,$3,$4,'owner')`,[userId,merchantId,normalized,passwordHash]); await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');if(e?.code==='23505'){e.status=409;e.message='email_or_shop_already_registered';}throw e;}finally{client.release();} const token=await createMerchantSession(pool,userId); return {token,user:{id:userId,merchant_id:merchantId,email:normalized,role:'owner',merchant_name:merchantName,slug:merchantSlug,shop_slug:merchantSlug}}; }

export async function logoutMerchant(pool,req,res) { const token=requestToken(req); if(/^[a-f0-9]{64}$/i.test(token||''))await pool.query('DELETE FROM merchant_sessions WHERE token_hash=$1',[hashToken(token)]); clearMerchantSessionCookie(res); }
export async function requireMerchant(req,res,next) { try{const user=await getMerchantFromRequest(req.app.locals.pool,req);if(!user)return res.status(401).json({ok:false,error:'authentication_required'});req.merchantUser=user;next();}catch(e){next(e);} }
export function hashMerchantPassword(password){return hashPassword(password);} export function verifyMerchantPassword(password,encoded){return verifyPassword(password,encoded);}

const CUSTOMER_COOKIE_NAME = 'zq_customer_session';

function customerRequestToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return readCookie(req, CUSTOMER_COOKIE_NAME);
}

export function setCustomerSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${CUSTOMER_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${SESSION_DAYS * 86400}`);
}

export function clearCustomerSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${CUSTOMER_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`);
}

export async function getCustomerFromRequest(pool, req) {
  const token = customerRequestToken(req);
  if (!/^[a-f0-9]{64}$/i.test(token || '')) return null;
  const r = await pool.query(
    `SELECT c.id,c.email,c.first_name,c.last_name
       FROM customer_sessions s
       JOIN customers c ON c.id=s.customer_id
      WHERE s.token_hash=$1 AND s.expires_at>now()
      LIMIT 1`,
    [hashToken(token)]
  );
  if (!r.rows[0]) return null;
  return r.rows[0];
}

export async function createCustomerSession(pool, customerId) {
  const token = createSessionToken();
  await pool.query(`INSERT INTO customer_sessions(customer_id,token_hash,expires_at) VALUES($1,$2,now()+interval '${SESSION_DAYS} days')`, [customerId, hashToken(token)]);
  return token;
}

export async function registerCustomer(pool, { email, password, firstName, first_name, lastName, last_name }) {
  const normalized = String(email || '').trim().toLowerCase();
  const first = String(firstName ?? first_name ?? '').trim().slice(0, 80);
  const last = String(lastName ?? last_name ?? '').trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254 || !validatePassword(password)) {
    const e = new Error('invalid_registration'); e.status = 400; throw e;
  }
  const passwordHash = hashPassword(password);
  try {
    const r = await pool.query(
      `INSERT INTO customers(email,password_hash,first_name,last_name)
       VALUES($1,$2,$3,$4)
       RETURNING id,email,first_name,last_name`,
      [normalized,passwordHash,first || null,last || null]
    );
    const customer = r.rows[0];
    const token = await createCustomerSession(pool, customer.id);
    return { token, customer };
  } catch (e) {
    if (e?.code === '23505') { e.status = 409; e.message = 'email_already_registered'; }
    throw e;
  }
}

export async function loginCustomer(pool, email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const r = await pool.query(
    `SELECT id,email,first_name,last_name,password_hash
       FROM customers WHERE lower(email)=$1 LIMIT 1`,
    [normalized]
  );
  const customer = r.rows[0];
  if (!customer || !verifyPassword(String(password || ''), customer.password_hash)) return null;
  const token = await createCustomerSession(pool, customer.id);
  return {
    token,
    customer: {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name
    }
  };
}

export async function logoutCustomer(pool, req, res) {
  const token = customerRequestToken(req);
  if (/^[a-f0-9]{64}$/i.test(token || '')) {
    await pool.query('DELETE FROM customer_sessions WHERE token_hash=$1', [hashToken(token)]);
  }
  clearCustomerSessionCookie(res);
}
