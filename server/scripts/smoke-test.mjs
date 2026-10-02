import assert from 'node:assert/strict';

const base = process.env.ZQ_SMOKE_BASE || 'http://127.0.0.1:8080';
const stamp = Date.now();
const merchantEmail = `smoke-${stamp}@zorqemi.test`;
const customerEmail = `customer-${stamp}@zorqemi.test`;
const password = 'ZorqemiSmoke!2026';
const slug = `smoke-${stamp}`;

async function request(path, options = {}) {
  const response = await fetch(base + path, options);
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch {}
  return {response, payload, text};
}

function cookieFrom(response, name) {
  const raw = response.headers.get('set-cookie') || '';
  const match = raw.match(new RegExp(`(?:^|, )${name}=([^;]+)`));
  return match ? match[1] : '';
}

console.log('1/8 health');
{
  const {response, text: healthText} = await request('/healthz');
  assert.equal(response.status, 200);
  assert.match(healthText, /ok/);
}

console.log('2/8 merchant registration + session');
const merchantRegister = await request('/api/v1/auth/register', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: merchantEmail, password, merchant_name: 'Zorqemi Smoke Shop', shop_slug: slug})
});
assert.equal(merchantRegister.response.status, 201);
const merchantCookie = cookieFrom(merchantRegister.response, 'zq_session');
assert.ok(merchantCookie);
const merchantId = merchantRegister.payload.user?.merchant_id;
assert.ok(merchantId);

console.log('3/8 merchant auth + product creation');
{
  const {response, payload} = await request('/api/v1/auth/me', {headers: {Cookie: `zq_session=${merchantCookie}`}});
  assert.equal(response.status, 200);
  assert.equal(payload.user.merchant_id, merchantId);
}
const productResult = await request(`/api/v1/merchant/${merchantId}/products`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', Cookie: `zq_session=${merchantCookie}`},
  body: JSON.stringify({name: 'Smoke Test Produkt', description: 'Automatischer Server-Test', price: 9.99, stock: 5, category: 'Test', active: true})
});
assert.equal(productResult.response.status, 201);
const productId = productResult.payload.product?.id;
assert.ok(productId);

console.log('4/8 publish + public shop');
{
  const {response} = await request(`/api/v1/merchant/${merchantId}/profile`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json', Cookie: `zq_session=${merchantCookie}`},
    body: JSON.stringify({vat_id: 'DE123456789', contact_email: merchantEmail, description: 'Smoke Test Shop', published: true})
  });
  assert.equal(response.status, 200);
}
{
  const {response, payload} = await request('/api/v1/shop/products', {headers: {Host: `${slug}.zorqemishop.de`}});
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.products.length, 1);
  assert.equal(payload.products[0].id, productId);
}

console.log('5/8 guest cart');
const visitorKey = crypto.randomUUID();
const cartAdd = await request('/api/v1/cart/items', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'x-zorqemi-visitor-key': visitorKey},
  body: JSON.stringify({product_id: productId, quantity: 1})
});
assert.equal(cartAdd.response.status, 201);
assert.equal(cartAdd.payload.items.length, 1);
assert.equal(cartAdd.payload.items[0].quantity, 1);

console.log('6/8 customer registration + session');
const customerRegister = await request('/api/v1/customer/auth/register', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: customerEmail, password, first_name: 'Zorqemi', last_name: 'Smoke'})
});
assert.equal(customerRegister.response.status, 201);
const customerCookie = cookieFrom(customerRegister.response, 'zq_customer_session');
assert.ok(customerCookie);

console.log('7/8 customer cart');
{
  const {response} = await request('/api/v1/cart', {headers: {Cookie: `zq_customer_session=${customerCookie}`}});
  assert.equal(response.status, 200);
}
console.log('8/8 checkout configuration guard');
{
  const checkout = await request('/api/v1/checkout/session', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Cookie: `zq_customer_session=${customerCookie}`},
    body: JSON.stringify({
      idempotency_key: `smoke-${stamp}-abcdefghijkl`,
      items: [{product_id: productId, quantity: 1}],
      customer_email: customerEmail,
      shipping_address: {name: 'Smoke Test', line1: 'Teststraße 1', postal_code: '08000', city: 'Zwickau', country: 'DE'}
    })
  });
  assert.equal(checkout.response.status, 503);
  assert.equal(checkout.payload.error, 'stripe_not_configured');
}

console.log('SMOKE TEST PASSED: server, auth, product, publication, public shop, cart and checkout guard are working.');
