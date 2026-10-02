(() => {
  const TRACK = 'https://oansbivjkczjbtxaknks.supabase.co/functions/v1/track-visitor';
  const db = window.supabase?.createClient?.(window.__RK_SUPABASE_URL, window.__RK_SUPABASE_KEY);

  const visitorId = () => {
    try {
      let id = localStorage.getItem('zq_anonymous_visitor_id');
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('zq_anonymous_visitor_id', id);
      }
      return id;
    } catch (_) {
      return crypto.randomUUID();
    }
  };

  const shopSlug = () =>
    new URLSearchParams(location.search).get('shop') ||
    localStorage.getItem('zq_checkout_shop') ||
    '';

  const send = (eventName, productId = null) => {
    const slug = shopSlug();
    if (!slug) return;
    fetch(TRACK, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        slug,
        visitor_key: visitorId(),
        event_name: eventName,
        product_id: productId,
        resolve: false
      }),
      keepalive: true
    }).catch(() => {});
  };

  function productIdFromCard(card) {
    const button = card.querySelector('button[onclick*="addToCart"]');
    const value = button?.getAttribute('onclick') || '';
    const match = value.match(/addToCart\\((\\d+)\\)/);
    return match ? Number(match[1]) : null;
  }

  function trackPublicProducts() {
    if (!shopSlug() || !('IntersectionObserver' in window)) return;
    const seenKey = 'zq_product_views_' + shopSlug();
    let seen = {};
    try { seen = JSON.parse(sessionStorage.getItem(seenKey) || '{}'); } catch (_) {}

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = productIdFromCard(entry.target);
        if (!id || seen[id]) return;
        seen[id] = 1;
        try { sessionStorage.setItem(seenKey, JSON.stringify(seen)); } catch (_) {}
        send('product_view', id);
      });
    }, {threshold: 0.45});

    const observe = () => {
      document.querySelectorAll('.product').forEach(card => {
        if (card.dataset.zqObserved === '1') return;
        card.dataset.zqObserved = '1';
        observer.observe(card);
      });
    };
    observe();
    new MutationObserver(observe).observe(document.body, {childList: true, subtree: true});
  }

  function patchCart() {
    if (!window.addToCart || window.addToCart.__zqProductAnalytics) return;
    const original = window.addToCart;
    const wrapped = function(id) {
      send('add_to_cart', Number(id));
      return original.apply(this, arguments);
    };
    wrapped.__zqProductAnalytics = true;
    window.addToCart = wrapped;
  }

  async function dashboard() {
    if (!db) return;
    if (window.serverSession && window.serverFetch) return;
    const {data: userData} = await db.auth.getUser();
    const user = userData?.user;
    if (!user) return;
    const {data: merchant} = await db.from('merchants').select('id').eq('owner_id', user.id).maybeSingle();
    const panel = document.querySelector('#dashboardOverview');
    if (!merchant || !panel) return;

    let box = document.querySelector('#zqRealFunnel');
    if (!box) {
      box = document.createElement('article');
      box.className = 'panel zq-analytics';
      box.id = 'zqRealFunnel';
      box.innerHTML = '<div class="panel-head"><h3>Checkout-Trichter</h3><span>Letzte 30 Tage</span></div><div id="zqRealFunnelBody" class="zq-funnel-card"><div class="muted">Wird geladen …</div></div>';
      panel.appendChild(box);
    }

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const {data: events, error} = await db.from('checkout_events')
      .select('event_name,product_id,created_at')
      .eq('merchant_id', merchant.id)
      .gte('created_at', since);

    if (error) {
      document.querySelector('#zqRealFunnelBody').textContent = 'Checkout-Statistik konnte nicht geladen werden.';
      return;
    }

    const rows = events || [];
    const count = name => rows.filter(row => row.event_name === name).length;
    const started = count('checkout_started');
    const purchase = count('purchase_completed');
    const cancelled = count('payment_cancelled');
    const pct = (n, d) => d ? Math.round(n / d * 100) : 0;

    document.querySelector('#zqRealFunnelBody').innerHTML = [
      ['Checkout gestartet', started, 100],
      ['Kauf abgeschlossen', purchase, pct(purchase, started)],
      ['Zahlung abgebrochen', cancelled, pct(cancelled, started)]
    ].map(row => `<div class="zq-funnel-row"><div class="zq-funnel-top"><span>${row[0]}</span><strong>${row[1]} · ${row[2]}%</strong></div><div class="zq-funnel-track"><div class="zq-funnel-fill" style="width:${Math.max(row[1] ? 3 : 0, row[2])}%"></div></div></div>`).join('');
  }

  const init = () => {
    trackPublicProducts();
    patchCart();
    dashboard();
    setTimeout(patchCart, 700);
    setTimeout(patchCart, 1800);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true});
  } else {
    init();
  }
})();