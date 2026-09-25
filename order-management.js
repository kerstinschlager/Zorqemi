(() => {
  const db = window.supabase?.createClient(window.__RK_SUPABASE_URL, window.__RK_SUPABASE_KEY);
  if (!db) return;
  const money = n => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const state = { orders: [], target: '#orders' };

  async function getMerchant() {
    if (window.serverSession && window.merchant) return window.merchant;
    const { data: session } = await db.auth.getSession();
    const uid = session.session?.user?.id;
    if (!uid) return null;
    const { data } = await db.from('merchants').select('*').eq('owner_id', uid).maybeSingle();
    return data || null;
  }

  async function loadOrders() {
    const merchant = await getMerchant();
    if (!merchant) return [];
    if (window.serverSession && window.serverFetch) {
      const r = await window.serverFetch('/merchant/'+encodeURIComponent(merchant.id)+'/orders?limit=200');
      if (!r.response.ok) throw new Error(r.payload?.error || 'orders_load_failed');
      return Array.isArray(r.payload?.orders) ? r.payload.orders : [];
    }
    const { data: prodIds, error: prodError } = await db.from('products').select('id').eq('merchant_id', merchant.id);
    if (prodError) throw prodError;
    const ids = (prodIds || []).map(p => p.id);
    if (!ids.length) return [];
    const { data: items, error } = await db.from('order_items').select('order_id,product_id,product_name,quantity,unit_price,orders(id,status,total,created_at,shipping_carrier,tracking_number,tracking_url,shipped_at)').in('product_id', ids);
    if (error) throw error;
    const grouped = {};
    (items || []).forEach(i => { const o = i.orders; if (!o) return; (grouped[o.id] ??= { ...o, items: [] }).items.push(i); });
    return Object.values(grouped).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }

  function statusLabel(s) {
    return ({new:'Offen', paid:'Bezahlt', processing:'In Bearbeitung', shipped:'Versendet', completed:'Abgeschlossen', cancelled:'Storniert'})[s] || s;
  }

  function render(target, orders) {
    const root = document.querySelector(target);
    if (!root) return;
    const active = orders.filter(o => o.status !== 'cancelled');
    const counts = {
      all: active.length,
      paid: active.filter(o => o.status === 'paid').length,
      processing: active.filter(o => o.status === 'processing').length,
      shipped: active.filter(o => o.status === 'shipped').length,
      completed: active.filter(o => o.status === 'completed').length,
      refunded: active.filter(o => o.status === 'refunded').length
    };
    root.innerHTML = `
      <div class="order-management-head">
        <div>
          <strong>Bestellungen</strong>
          <div class="muted">Bezahlte und bearbeitete Bestellungen deines Shops</div>
        </div>
        <select id="rkOrderFilter" aria-label="Bestellstatus filtern">
          <option value="all">Alle (${counts.all})</option>
          <option value="paid">Bezahlt (${counts.paid})</option>
          <option value="processing">In Bearbeitung (${counts.processing})</option>
          <option value="shipped">Versendet (${counts.shipped})</option>
          <option value="completed">Abgeschlossen (${counts.completed})</option>
          <option value="refunded">Erstattet (${counts.refunded})</option>
        </select>
      </div>
      <div class="order-summary">
        <span>Artikelumsatz: <strong>${money(active.reduce((s,o) => s + o.items.reduce((x,i)=>x + Number(i.unit_price)*Number(i.quantity),0),0))}</strong></span>
        <span>Offene Bearbeitung: <strong>${counts.paid + counts.processing}</strong></span>
      </div>
      <div id="rkOrderList"></div>`;
    const filter = root.querySelector('#rkOrderFilter');
    const list = root.querySelector('#rkOrderList');
    const draw = () => {
      const value = filter.value;
      const shown = value === 'all' ? active : active.filter(o => o.status === value);
      list.innerHTML = shown.map(o => {
        const merchantTotal = o.items.reduce((s,i) => s + Number(i.unit_price) * Number(i.quantity), 0);
        return `<div class="order-row rk-order-card"><div><strong>Bestellung #${o.id}</strong><div class="muted">${new Date(o.created_at).toLocaleString('de-DE')} · ${o.items.map(i => `${esc(i.product_name)} × ${i.quantity}`).join(', ')}</div><div class="rk-shipping"><label>Status<select onchange="changeOrderStatus('${o.id}',this.value)"><option value="paid" ${o.status==='paid'?'selected':''}>Bezahlt</option><option value="processing" ${o.status==='processing'?'selected':''}>In Bearbeitung</option><option value="shipped" ${o.status==='shipped'?'selected':''}>Versendet</option><option value="completed" ${o.status==='completed'?'selected':''}>Abgeschlossen</option><option value="cancelled" ${o.status==='cancelled'?'selected':''}>Storniert</option></select></label><label>Versanddienstleister<input id="carrier-${o.id}" value="${esc(o.shipping_carrier||'')}" placeholder="z. B. DHL"></label><label>Sendungsnummer<input id="tracking-${o.id}" value="${esc(o.tracking_number||'')}" placeholder="Sendungsnummer"></label><label>Tracking-Link<input id="tracking-url-${o.id}" value="${esc(o.tracking_url||'')}" placeholder="https://…"></label><button class="secondary" type="button" onclick="saveShipping('${o.id}')">Versanddaten speichern</button>${o.shipped_at?`<span class="muted">Versendet am ${new Date(o.shipped_at).toLocaleDateString('de-DE')}</span>`:''}</div></div><div><strong>${money(merchantTotal)}</strong><div class="muted">${statusLabel(o.status)}</div></div></div>`;
      }).join('') || '<p class="muted">Keine passenden Bestellungen.</p>';
    };
    filter.onchange = draw;
    draw();
  }

  window.renderMerchantOrders = async function(target = '#orders') {
    try {
      state.target = target;
      state.orders = await loadOrders();
      render(target, state.orders);
    } catch (e) {
      console.error(e);
      const root = document.querySelector(target);
      if (root) root.innerHTML = '<p class="muted">Bestellungen konnten nicht geladen werden.</p>';
    }
  };

  window.changeOrderStatus = async (id, status) => {
    if (window.serverSession && window.merchant && window.serverFetch) {
      const r = await window.serverFetch('/merchant/'+encodeURIComponent(window.merchant.id)+'/orders/'+encodeURIComponent(id), {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
      if (!r.response.ok) return alert(r.payload?.error==='invalid_status'?'Der Bestellstatus ist ungültig.':'Bestellstatus konnte nicht aktualisiert werden.');
    } else {
      const { error } = await db.rpc('merchant_set_order_status', { p_order_id: id, p_status: status });
      if (error) return alert(error.message);
    }
    if (typeof window.toast === 'function') window.toast('Bestellstatus aktualisiert');
    await window.renderMerchantOrders('#orders'); await window.renderMerchantOrders('#ordersFull');
  };

  window.saveShipping = async (id) => {
    const carrier = document.querySelector('#carrier-'+id)?.value.trim() || null;
    const tracking = document.querySelector('#tracking-'+id)?.value.trim() || null;
    const trackingUrl = document.querySelector('#tracking-url-'+id)?.value.trim() || null;
    if (trackingUrl && !/^https?:\\/\\//i.test(trackingUrl)) return alert('Der Tracking-Link muss mit http:// oder https:// beginnen.');
    if (window.serverSession && window.merchant && window.serverFetch) {
      const r = await window.serverFetch('/merchant/'+encodeURIComponent(window.merchant.id)+'/orders/'+encodeURIComponent(id)+'/shipping', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipping_carrier:carrier,tracking_number:tracking,tracking_url:trackingUrl})});
      if (!r.response.ok) return alert(r.payload?.error==='invalid_shipping'?'Die Versanddaten sind ungültig.':'Versanddaten konnten nicht gespeichert werden.');
      if (typeof window.toast === 'function') window.toast('Versanddaten gespeichert');
      await window.renderMerchantOrders('#orders'); await window.renderMerchantOrders('#ordersFull'); return;
    }
    const { error } = await db.rpc('merchant_update_shipping', {
      p_order_id: id,
      p_shipping_carrier: carrier,
      p_tracking_number: tracking,
      p_tracking_url: trackingUrl
    });
    if (error) return alert(error.message);
    if (typeof window.toast === 'function') window.toast('Versanddaten gespeichert');
    await window.renderMerchantOrders('#orders');
    await window.renderMerchantOrders('#ordersFull');
  };

  const existingDashboard = window.renderDashboard;
  if (typeof existingDashboard === 'function') {
    window.renderDashboard = async function(...args) {
      await existingDashboard.apply(this, args);
      await window.renderMerchantOrders('#orders');
    };
  }

  const existingSetDashTab = window.setDashTab;
  if (typeof existingSetDashTab === 'function') {
    window.setDashTab = async function(tab) {
      document.querySelectorAll('.dash-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.querySelectorAll('.dash-panel').forEach(p => p.classList.add('hidden'));
      const map = { overview:'#dashboardOverview', products:'#dashboardProducts', orders:'#dashboardOrders', settings:'#dashboardSettings', legal:'#dashboardLegal', checklist:'#dashboardChecklist', faq:'#dashboardFaq', marketing:'#dashboardMarketing' };
      document.querySelector(map[tab] || map.overview)?.classList.remove('hidden');
      if (tab === 'overview') {
        if (typeof window.renderDashboard === 'function') await window.renderDashboard();
      } else if (tab === 'orders') {
        await window.renderMerchantOrders('#ordersFull');
      } else if (tab === 'products' && typeof window.renderProductsFull === 'function') {
        await window.renderProductsFull();
      } else if (tab === 'settings' && typeof window.loadSettingsForm === 'function') {
        await window.loadSettingsForm();
      }
    };
  }

  const shippingStyle=document.createElement('style');
  shippingStyle.textContent='.rk-order-card{align-items:flex-start}.rk-shipping{margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:10px}.rk-shipping label{display:flex;flex-direction:column;gap:5px;font-size:13px}.rk-shipping input,.rk-shipping select{padding:9px;border:1px solid #d9d3e5;border-radius:8px;background:#fff}.rk-shipping button{align-self:end}.rk-shipping .muted{align-self:center}@media(max-width:800px){.rk-shipping{grid-template-columns:1fr}}';
  document.head.appendChild(shippingStyle);
})();
