(function(){
  const db=window.supabase.createClient(window.__RK_SUPABASE_URL,window.__RK_SUPABASE_KEY);
  const q=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);
  const wishKey='rk_wishlist';
  const getWishlist=()=>{try{return JSON.parse(localStorage.getItem(wishKey)||'[]')}catch{return[]}};
  const saveWishlist=a=>localStorage.setItem(wishKey,JSON.stringify(a));
  function toastA(t){if(typeof toast==='function')toast(t)}
  function mount(){
    const header=document.querySelector('.header-actions'); if(!header||q('#accountBtn'))return;
    const b=document.createElement('button');b.id='accountBtn';b.className='cart-btn';b.textContent='Mein Konto';header.insertBefore(b,q('#authBtn'));b.addEventListener('click',openAccount);
    const s=document.createElement('section');s.id='accountView';s.className='view hidden';
    s.innerHTML='<div class="page-head"><div><p class="eyebrow">KUNDENKONTO</p><h2>Mein Konto</h2><p>Deine Bestellungen, Versandstatus und Benachrichtigungen.</p><button id="customerLogout" class="secondary" type="button">Abmelden</button></div></div><div class="panel" id="customerWishlistPanel"><div class="panel-head"><h3>♡ Meine Merkliste</h3><span id="customerWishlistCount"></span></div><div id="customerWishlist"><p class="muted">Noch keine Produkte gemerkt.</p></div></div><div class="panel" id="customerNotificationsPanel"><div class="panel-head"><h3>Benachrichtigungen</h3><button id="markNotificationsRead" class="secondary" type="button">Alle als gelesen markieren</button><span id="customerNotificationCount"></span></div><div id="customerNotifications"><p class="muted">Wird geladen …</p></div></div><div class="panel" id="customerOrdersPanel"><div class="panel-head"><h3>Meine Bestellungen</h3><span id="customerOrderCount"></span></div><div id="customerOrders"><p class="muted">Wird geladen …</p></div></div>';
    document.querySelector('main').appendChild(s);
    const st=document.createElement('style');st.textContent='#accountView{max-width:1180px;margin:50px auto 80px;padding:0 20px}.customer-order{border-top:1px solid #ddd;padding:18px 0;display:flex;justify-content:space-between;gap:20px}.customer-order:first-child{border-top:0}.customer-status{display:inline-flex;padding:6px 10px;border-radius:999px;background:#eef7d6;font-weight:700}.customer-items{margin-top:8px;color:#6b6873}.customer-total{font-size:18px;font-weight:800}.customer-shipping{margin-top:10px;padding:10px 12px;border:1px solid #ddd;border-radius:10px}.customer-notice{border-top:1px solid #ddd;padding:12px 0}.customer-notice:first-child{border-top:0}.customer-notice strong{display:block}.customer-notice span{color:#6b6873}.tracking-link{display:inline-block;margin-top:7px;font-weight:700}.rk-unread{font-weight:800}.customer-wishlist-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.customer-wish-card{border:1px solid #ddd;border-radius:14px;overflow:hidden;background:#fff}.customer-wish-card img,.customer-wish-placeholder{width:100%;height:150px;object-fit:cover;display:block;background:#f0ebf7}.customer-wish-placeholder{display:grid;place-items:center;font-weight:900}.customer-wish-body{padding:11px}.customer-wish-body strong{display:block}.customer-wish-body small{display:block;color:#777;margin-top:4px}.customer-wish-actions{display:flex;gap:8px;margin-top:10px}.customer-wish-actions button{flex:1}.customer-wish-link{text-decoration:none;color:inherit}@media(max-width:900px){.customer-wishlist-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.customer-order{flex-direction:column}}';document.head.appendChild(st);
    q('#markNotificationsRead').addEventListener('click',markNotificationsRead);q('#customerLogout').addEventListener('click',customerLogout);
    renderWishlist();
  }
  async function api(path,options={}){
    const r=await fetch(path,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    let data=null;try{data=await r.json()}catch{}
    if(!r.ok)throw new Error(data?.error||'api_error');return data;
  }
  async function customerLogout(){try{await api('/api/v1/customer/auth/logout',{method:'POST'});window.location.reload()}catch(e){toastA('Abmelden momentan nicht möglich')}}
  async function openAccount(){
    let customer=null;try{customer=(await api('/api/v1/customer/auth/me')).customer}catch{}
    if(!customer){toastA('Bitte zuerst anmelden');q('#authModal')?.classList.remove('hidden');window.setZqAuthContext?.('customer');if(typeof setAuthMode==='function')setAuthMode('login');return}
    document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));q('#accountView').classList.remove('hidden');document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));renderWishlist();await loadOrdersAndNotifications();window.scrollTo({top:0,behavior:'smooth'});
  }
  async function loadOrdersAndNotifications(){await Promise.all([loadOrders(),loadNotifications()])}
  async function loadNotifications(){
    const box=q('#customerNotifications'),count=q('#customerNotificationCount');
    const {data,error}=await db.from('order_notifications').select('id,order_id,title,message,created_at,read_at').order('created_at',{ascending:false}).limit(20);
    if(error){console.error(error);box.innerHTML='<p class="muted">Benachrichtigungen konnten nicht geladen werden.</p>';return}
    const rows=data||[];count.textContent=`${rows.filter(x=>!x.read_at).length} neu`;
    box.innerHTML=rows.map(n=>`<div class="customer-notice ${n.read_at?'':'rk-unread'}"><strong>${esc(n.title)} · Bestellung #${n.order_id}</strong><span>${esc(n.message)} · ${new Date(n.created_at).toLocaleString('de-DE')}</span></div>`).join('')||'<p class="muted">Keine Benachrichtigungen.</p>';
  }
  async function markNotificationsRead(){
    const {error}=await db.from('order_notifications').update({read_at:new Date().toISOString()}).is('read_at',null);
    if(error){console.error(error);toastA('Benachrichtigungen konnten nicht aktualisiert werden');return}
    toastA('Benachrichtigungen als gelesen markiert');await loadNotifications();
  }
  async function renderWishlist(){
    const box=q('#customerWishlist'),count=q('#customerWishlistCount');if(!box)return;
    const ids=getWishlist();count.textContent=`${ids.length} ${ids.length===1?'Produkt':'Produkte'}`;
    if(!ids.length){box.innerHTML='<p class="muted">Noch keine Produkte gemerkt. Klicke bei einem Produkt auf ♡, um es später wiederzufinden.</p>';return}
    const {data,error}=await db.from('products').select('id,name,price,image_url,stock,active,merchant_id').in('id',ids);
    if(error){console.error(error);box.innerHTML='<p class="muted">Merkliste konnte nicht geladen werden.</p>';return}
    const products=data||[];const mids=[...new Set(products.map(p=>p.merchant_id).filter(Boolean))];let merchants={};if(mids.length){const r=await db.from('public_merchants').select('id,shop_name,slug').in('id',mids);if(!r.error)(r.data||[]).forEach(m=>merchants[m.id]=m)}
    box.innerHTML=`<div class="customer-wishlist-grid">${products.map(p=>{const m=merchants[p.merchant_id],href=m?.slug?`${location.pathname}?shop=${encodeURIComponent(m.slug)}#shop`:'#shop';return `<article class="customer-wish-card"><a class="customer-wish-link" href="${esc(href)}">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div class="customer-wish-placeholder">RK</div>'}<div class="customer-wish-body"><strong>${esc(p.name)}</strong><small>${esc(m?.shop_name||'Rebelkultur Händler')} · ${money(p.price)}</small><div class="customer-wish-actions"><button type="button" class="secondary" data-wish-remove="${esc(p.id)}">Entfernen</button></div></div></a></article>`}).join('')}</div>`;
    box.querySelectorAll('[data-wish-remove]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const next=getWishlist().filter(id=>id!==b.dataset.wishRemove);saveWishlist(next);renderWishlist();toastA('Produkt aus der Merkliste entfernt')}));
  }
  window.rkRenderWishlist=renderWishlist;
  async function loadOrders(){
    const box=q('#customerOrders'),count=q('#customerOrderCount');
    try{
      const result=await api('/api/v1/customer/orders');
      const orders=result.orders||[];count.textContent=`${orders.length} ${orders.length===1?'Bestellung':'Bestellungen'}`;
      const labels={new:'Offen',paid:'Bezahlt',processing:'In Bearbeitung',shipped:'Versendet',completed:'Abgeschlossen',cancelled:'Storniert'};
      box.innerHTML=orders.map(o=>{
        const shipping=(o.tracking_number||o.shipping_carrier||o.tracking_url)?`<div class="customer-shipping"><strong>Versand</strong>${o.shipping_carrier?`<div>${esc(o.shipping_carrier)}</div>`:''}${o.tracking_number?`<div>Sendungsnummer: ${esc(o.tracking_number)}</div>`:''}${o.tracking_url?`<a class="tracking-link" href="${esc(o.tracking_url)}" target="_blank" rel="noopener">Sendung verfolgen</a>`:''}</div>`:''; 
        return `<div class="customer-order"><div><strong>Bestellung #${o.id}</strong><div class="muted">${new Date(o.created_at).toLocaleString('de-DE')}</div><div class="customer-items">${(o.items||[]).map(i=>`${esc(i.product_name)} × ${i.quantity} · ${money(i.unit_price)}`).join('<br>')}</div>${shipping}</div><div><div class="customer-status">${esc(labels[o.status]||o.status)}</div><div class="customer-total">${money(o.total)}</div></div></div>`;
      }).join('')||'<p class="muted">Du hast noch keine Bestellungen.</p>';
    }catch(e){console.error(e);box.innerHTML='<p class="muted">Bestellungen konnten nicht geladen werden.</p>';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();