(() => {
  const API = '/api/v1/shop';
  const SHOP_ROOTS = new Set(['zorqemi.de', 'www.zorqemi.de', 'zorqemishop.de', 'www.zorqemishop.de', 'localhost', '127.0.0.1']);
  const money = n => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const esc = v => String(v ?? '').replace(/[&<>\'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));

  async function getShop() {
    try {
      const response = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload?.ok ? payload.shop : null;
    } catch (_) {
      return null;
    }
  }

  async function loadShopProducts(shop) {
    const db = window.zqDb;
    if (!db || !shop?.id) return false;
    const result = await db.from('products')
      .select('id,name,slug,description,price,stock,image_url,created_at,category_id')
      .eq('merchant_id', shop.id)
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (result.error) {
      console.error('ZorqemiShop product load failed', result.error);
      return false;
    }

    const rows = result.data || [];
    const ids = [...new Set(rows.map(p => p.category_id).filter(Boolean))];
    const categories = {};
    if (ids.length) {
      const cats = await db.from('categories').select('id,name').in('id', ids);
      if (!cats.error) (cats.data || []).forEach(c => categories[c.id] = c.name);
    }

    const grid = document.querySelector('#productGrid');
    if (!grid) return false;
    const products = rows.map(p => ({ ...p, category: categories[p.category_id] || 'Produkte' }));
    window.zqPublicShopProducts = products;

    grid.innerHTML = products.map(p => `
      <article class="product">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">` : '<div class="placeholder">ZQ</div>'}
        <div class="product-body">
          <div class="muted">${esc(p.category)}</div>
          <h3>${esc(p.name)}</h3>
          <p class="muted">${esc(p.description || '')}</p>
          <div class="price">${money(p.price)}</div>
          <button class="add" data-zq-product-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock > 0 ? 'In den Warenkorb' : 'Ausverkauft'}</button>
        </div>
      </article>`).join('') || '<p>Dieser Shop hat noch keine veröffentlichten Produkte.</p>';

    grid.querySelectorAll('[data-zq-product-id]').forEach(button => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.zqProductId);
        if (typeof window.addToCart === 'function') window.addToCart(id);
      });
    });

    return true;
  }

  async function bootstrap() {
    const host = location.hostname.toLowerCase().replace(/^www\./, '');
    if (SHOP_ROOTS.has(host) || host.endsWith('.github.io')) return;

    const shop = await getShop();
    if (!shop) return;
    window.zqPublicShop = shop;
    document.title = `${shop.name || shop.shop_slug || 'Shop'} – ZorqemiShop`;

    const brand = document.querySelector('.brand strong');
    if (brand) brand.textContent = shop.name || shop.shop_slug || 'ZorqemiShop';
    const heroTitle = document.querySelector('#shopView .hero h1');
    const heroText = document.querySelector('#shopView .hero p');
    const heroCard = document.querySelector('#shopView .hero-card');
    if (heroTitle) heroTitle.innerHTML = `${esc(shop.name || shop.shop_slug || 'Dein Shop')}. <span>Bei ZorqemiShop.</span>`;
    if (heroText) heroText.textContent = 'Produkte direkt aus diesem Händler-Shop.';
    if (heroCard) heroCard.innerHTML = `<div class="speed">ZQ</div><strong>${esc(shop.name || shop.shop_slug || 'ZORQEMI')}</strong><small>ZORQEMISHOP</small>`;

    await loadShopProducts(shop);
  }

  window.addEventListener('load', () => setTimeout(bootstrap, 250));
})();
