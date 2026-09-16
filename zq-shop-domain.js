(() => {
  const API = '/api/v1/shop';
  const SHOP_ROOTS = new Set(['zorqemi.de', 'www.zorqemi.de', 'zorqemishop.de', 'www.zorqemishop.de', 'localhost', '127.0.0.1']);
  const money = n => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const esc = v => String(v ?? '').replace(/[&<>\'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));

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

  async function loadShopProducts() {
    try {
      const response = await fetch(`${API}/products`, { headers: { Accept: 'application/json' } });
      if (!response.ok) return false;
      const payload = await response.json();
      if (!payload?.ok) return false;

      const grid = document.querySelector('#productGrid');
      if (!grid) return false;
      const products = (payload.products || []).map(p => ({
        ...p,
        category: p.category || 'Produkte',
        image: p.image_url || ''
      }));
      window.zqPublicShopProducts = products;
      window.products = products;

      grid.innerHTML = products.map(p => `
        <article class="product">
          ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : '<div class="placeholder">ZQ</div>'}
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
          const id = button.dataset.zqProductId;
          const product = products.find(p => String(p.id) === String(id));
          if (!product) return;
          if (typeof window.addToCart === 'function') window.addToCart(product.id);
        });
      });

      return true;
    } catch (error) {
      console.error('ZorqemiShop product load failed', error);
      return false;
    }
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

    await loadShopProducts();
  }

  window.addEventListener('load', () => setTimeout(bootstrap, 250));
  window.addEventListener('load', () => setTimeout(() => {
    if (document.querySelector('#zqPerformance')) return;
    const script = document.createElement('script');
    script.src = './zq-performance.js?v=20260916-1';
    script.async = true;
    document.head.appendChild(script);
  }, 500));
})();
