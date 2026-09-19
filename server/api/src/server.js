import express from 'express';
import pg from 'pg';
import { migrate } from './migrate.js';
import { resolveShopByHost, getPublicShop } from './shop-router.js';
import { getMerchantForOwner, listMerchantProducts, createMerchantProduct, updateMerchantProduct, getMerchantOrders, updateMerchantOrder, getShopSettings, updateShopSettings, updateMerchantShipping, getMerchantProfile, updateMerchantProfile, getMerchantLegal, updateMerchantLegal } from './merchant-api.js';
import { getMerchantFromRequest, loginMerchant, registerMerchant, logoutMerchant, setMerchantSessionCookie, validatePassword } from './auth.js';
import { createCheckoutSession, handleStripeWebhook } from './checkout-api.js';
import { getMerchantPayouts, createMerchantPayout, markPayoutPaid, listAdminPayouts, getPlatformCommission, setPlatformCommission, listAdminMerchants, cancelMerchantPayout } from './payout-api.js';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX || 10), idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
app.locals.pool = pool;
app.disable('x-powered-by');

// Stripe requires the exact raw request body for webhook signature verification.
app.post('/api/v1/payments/stripe/webhook', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res) => {
  try {
    const result = await handleStripeWebhook(pool, req.body, req.get('stripe-signature'));
    res.json(result);
  } catch (error) {
    const status = Number(error?.status) || (error?.type === 'StripeSignatureVerificationError' ? 400 : 500);
    res.status(status).json({ ok: false, error: status < 500 ? (error.message || 'invalid_webhook') : 'internal_server_error' });
  }
});

app.use(express.json({ limit: '1mb' }));

app.get('/healthz', async (_req,res) => { try { const r=await pool.query('select current_timestamp as now'); res.json({ok:true,service:'zorqemi-api',database:'ok',time:r.rows[0].now}); } catch(e) { console.error('healthz',e); res.status(503).json({ok:false,service:'zorqemi-api',database:'unavailable'}); } });
app.get('/api/v1/status', async (_req,res) => { try { const r=await pool.query('select version from schema_migrations order by version desc limit 1'); res.json({ok:true,version:'0.4.0',migration:r.rows[0]?.version??null,database:'postgresql'}); } catch(e) { console.error('status',e); res.status(503).json({ok:false,version:'0.4.0',migration:'database-unavailable'}); } });

app.post('/api/v1/auth/register', async (req,res,next) => { try { const result=await registerMerchant(pool,req.body||{}); setMerchantSessionCookie(res,result.token); res.status(201).json({ok:true,user:result.user}); } catch(e) { next(e); } });
app.post('/api/v1/auth/login', async (req,res,next) => { try { const email=String(req.body?.email||'').trim(); const password=String(req.body?.password||''); if(!email||!validatePassword(password))return res.status(400).json({ok:false,error:'invalid_credentials'}); const result=await loginMerchant(pool,email,password); if(!result)return res.status(401).json({ok:false,error:'invalid_credentials'}); setMerchantSessionCookie(res,result.token); res.json({ok:true,user:result.user}); } catch(e){next(e);} });
app.get('/api/v1/auth/me', async (req,res,next) => { try { const user=await getMerchantFromRequest(pool,req); if(!user)return res.status(401).json({ok:false,error:'authentication_required'}); res.json({ok:true,user}); } catch(e){next(e);} });
app.post('/api/v1/auth/logout', async (req,res,next) => { try { await logoutMerchant(pool,req,res); res.json({ok:true}); } catch(e){next(e);} });

async function requireOwnMerchant(req,res,next) { try { const user=await getMerchantFromRequest(pool,req); if(!user)return res.status(401).json({ok:false,error:'authentication_required'}); req.merchantUser=user; next(); } catch(e){next(e);} }
function requestedMerchant(req){return req.params.merchantId;}

async function requirePlatformAdmin(req,res,next) {
  try {
    const user=await getMerchantFromRequest(pool,req);
    if(!user)return res.status(401).json({ok:false,error:'authentication_required'});
    if(user.role!=='admin')return res.status(403).json({ok:false,error:'admin_required'});
    req.merchantUser=user;
    next();
  } catch(e){next(e);}
}

app.get('/api/v1/merchant/:merchantId',requireOwnMerchant,async(req,res,next)=>{try{const merchant=await getMerchantForOwner(pool,requestedMerchant(req),req.merchantUser.user_id);if(!merchant)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,merchant});}catch(e){next(e);}});
app.get('/api/v1/merchant/:merchantId/products',requireOwnMerchant,async(req,res,next)=>{try{const data=await listMerchantProducts(pool,requestedMerchant(req),req.merchantUser.user_id);if(!data)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,...data});}catch(e){next(e);}});
app.post('/api/v1/merchant/:merchantId/products',requireOwnMerchant,async(req,res,next)=>{try{const product=await createMerchantProduct(pool,requestedMerchant(req),req.merchantUser.user_id,req.body||{});if(!product)return res.status(404).json({ok:false,error:'merchant_not_found'});res.status(201).json({ok:true,product});}catch(e){next(e);}});
app.patch('/api/v1/merchant/:merchantId/products/:productId',requireOwnMerchant,async(req,res,next)=>{try{const product=await updateMerchantProduct(pool,requestedMerchant(req),req.merchantUser.user_id,req.params.productId,req.body||{});if(!product)return res.status(404).json({ok:false,error:'product_not_found'});res.json({ok:true,product});}catch(e){next(e);}});
app.get('/api/v1/merchant/:merchantId/orders',requireOwnMerchant,async(req,res,next)=>{try{const orders=await getMerchantOrders(pool,requestedMerchant(req),req.merchantUser.user_id,req.query.limit);if(!orders)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,orders});}catch(e){next(e);}});
app.patch('/api/v1/merchant/:merchantId/orders/:orderId',requireOwnMerchant,async(req,res,next)=>{try{const order=await updateMerchantOrder(pool,requestedMerchant(req),req.merchantUser.user_id,req.params.orderId,String(req.body?.status||''));if(!order)return res.status(404).json({ok:false,error:'order_not_found_or_locked'});res.json({ok:true,order});}catch(e){next(e);}});
app.patch('/api/v1/merchant/:merchantId/orders/:orderId/shipping',requireOwnMerchant,async(req,res,next)=>{try{const order=await updateMerchantShipping(pool,requestedMerchant(req),req.merchantUser.user_id,req.params.orderId,req.body||{});if(!order)return res.status(404).json({ok:false,error:'order_not_found'});res.json({ok:true,order});}catch(e){next(e);}});
app.get('/api/v1/merchant/:merchantId/profile',requireOwnMerchant,async(req,res,next)=>{try{const profile=await getMerchantProfile(pool,requestedMerchant(req),req.merchantUser.user_id);if(!profile)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,profile});}catch(e){next(e);}});
app.patch('/api/v1/merchant/:merchantId/profile',requireOwnMerchant,async(req,res,next)=>{try{const profile=await updateMerchantProfile(pool,requestedMerchant(req),req.merchantUser.user_id,req.body||{});if(!profile)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,profile});}catch(e){next(e);}});
app.get('/api/v1/merchant/:merchantId/legal',requireOwnMerchant,async(req,res,next)=>{try{const legal=await getMerchantLegal(pool,requestedMerchant(req),req.merchantUser.user_id);if(!legal)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,legal});}catch(e){next(e);}});
app.patch('/api/v1/merchant/:merchantId/legal',requireOwnMerchant,async(req,res,next)=>{try{const legal=await updateMerchantLegal(pool,requestedMerchant(req),req.merchantUser.user_id,req.body||{});if(!legal)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,legal});}catch(e){next(e);}});
app.get('/api/v1/merchant/:merchantId/settings',requireOwnMerchant,async(req,res,next)=>{try{const settings=await getShopSettings(pool,requestedMerchant(req),req.merchantUser.user_id);if(!settings)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,settings});}catch(e){next(e);}});
app.get('/api/v1/merchant/:merchantId/payouts',requireOwnMerchant,async(req,res,next)=>{try{const data=await getMerchantPayouts(pool,requestedMerchant(req),req.merchantUser.user_id,req.query.limit);if(!data)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,...data});}catch(e){next(e);}});

app.get('/api/v1/admin/merchants',requirePlatformAdmin,async(req,res,next)=>{try{res.json({ok:true,merchants:await listAdminMerchants(pool,req.query.limit)});}catch(e){next(e);}});
app.get('/api/v1/admin/payouts',requirePlatformAdmin,async(req,res,next)=>{try{res.json({ok:true,payouts:await listAdminPayouts(pool,req.query.limit)});}catch(e){next(e);}});
app.post('/api/v1/admin/payouts/:merchantId',requirePlatformAdmin,async(req,res,next)=>{try{const payout=await createMerchantPayout(pool,req.params.merchantId);if(!payout)return res.status(409).json({ok:false,error:'no_payoutable_orders'});res.status(201).json({ok:true,payout});}catch(e){next(e);}});
app.patch('/api/v1/admin/payouts/:payoutId/cancel',requirePlatformAdmin,async(req,res,next)=>{try{const payout=await cancelMerchantPayout(pool,req.params.payoutId);if(!payout)return res.status(404).json({ok:false,error:'payout_not_found'});res.json({ok:true,payout});}catch(e){next(e);}});
app.patch('/api/v1/admin/payouts/:payoutId/paid',requirePlatformAdmin,async(req,res,next)=>{try{const payout=await markPayoutPaid(pool,req.params.payoutId,req.merchantUser.user_id);if(!payout)return res.status(404).json({ok:false,error:'payout_not_found_or_already_paid'});res.json({ok:true,payout});}catch(e){next(e);}});
app.get('/api/v1/admin/commission',requirePlatformAdmin,async(_req,res,next)=>{try{res.json({ok:true,rate:await getPlatformCommission(pool)});}catch(e){next(e);}});
app.patch('/api/v1/admin/commission',requirePlatformAdmin,async(req,res,next)=>{try{res.json({ok:true,rate:await setPlatformCommission(pool,req.body?.rate)});}catch(e){next(e);}});
app.patch('/api/v1/merchant/:merchantId/settings',requireOwnMerchant,async(req,res,next)=>{try{const settings=await updateShopSettings(pool,requestedMerchant(req),req.merchantUser.user_id,req.body||{});if(!settings)return res.status(404).json({ok:false,error:'merchant_not_found'});res.json({ok:true,settings});}catch(e){next(e);}});

// Public checkout: prices and stock are always read from PostgreSQL; client totals are ignored.
app.post('/api/v1/checkout/session', async (req,res,next) => {
  try {
    const result = await createCheckoutSession(pool, req.body || {});
    res.status(201).json({ ok: true, checkout: result });
  } catch (e) { next(e); }
});

app.get('/api/v1/shop',async(req,res,next)=>{try{const shop=await resolveShopByHost(pool,req.get('host'));if(!shop)return res.status(404).json({ok:false,error:'shop_not_found'});res.json({ok:true,shop});}catch(e){next(e);}});
app.get('/api/v1/shop/products',async(req,res,next)=>{try{const shop=await resolveShopByHost(pool,req.get('host'));if(!shop)return res.status(404).json({ok:false,error:'shop_not_found'});const result=await pool.query(`SELECT p.id,p.name,p.description,p.price,p.stock,p.active,p.image_url,p.category,p.source_provider,p.source_product_id,p.created_at,COALESCE(json_agg(json_build_object('id',v.id,'name',v.name,'sku',v.sku,'price',v.price,'stock',v.stock,'active',v.active,'source_variant_id',v.source_variant_id) ORDER BY v.created_at) FILTER(WHERE v.id IS NOT NULL),'[]'::json) variants FROM products p LEFT JOIN product_variants v ON v.product_id=p.id WHERE p.merchant_id=$1 AND p.active=true GROUP BY p.id ORDER BY p.created_at DESC`,[shop.id]);res.json({ok:true,shop,products:result.rows});}catch(e){next(e);}});
app.get('/api/v1/shop/:merchantId',async(req,res,next)=>{try{const shop=await getPublicShop(pool,req.params.merchantId);if(!shop)return res.status(404).json({ok:false,error:'shop_not_found'});res.json({ok:true,shop});}catch(e){next(e);}});

app.get('/api/v1/marketplace/products',async(_req,res,next)=>{try{const result=await pool.query(`
  SELECT p.id,p.merchant_id,p.name,p.description,p.price,p.stock,p.active,p.image_url,p.category,p.created_at,
         m.name AS merchant_name,m.slug AS merchant_slug,m.shop_slug
    FROM products p
    JOIN merchants m ON m.id=p.merchant_id
   WHERE p.active=true AND m.published=true
   ORDER BY p.created_at DESC
   LIMIT 500
`);res.json({ok:true,products:result.rows});}catch(e){next(e);}});

app.use((_req,res)=>res.status(404).json({ok:false,error:'not_found'}));
app.use((error,_req,res,_next)=>{console.error(error);const status=Number(error?.status)||500;res.status(status).json({ok:false,error:status<500?error.message:'internal_server_error'});});

try{await migrate(pool);const server=app.listen(port,'0.0.0.0',()=>console.log(`Zorqemi API listening on ${port}`));const shutdown=async(signal)=>{console.log(`Received ${signal}, shutting down`);server.close(async()=>{await pool.end();process.exit(0);});};process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));}catch(error){console.error('Database migration failed:',error);await pool.end();process.exit(1);}
