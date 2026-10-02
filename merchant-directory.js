(function(){
  const URL='https://oansbivjkczjbtxaknks.supabase.co';
  const KEY='sb_publishable_9tDZPZ9KmCjHZqVXBmO-1g_8Aqpu8qE';
  const db=window.supabase.createClient(URL,KEY);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let merchants=[];
  function loadMerchantShop(){if(document.querySelector('script[data-merchant-shop]'))return;const s=document.createElement('script');s.src='merchant-shop.js?v=20260911-1';s.dataset.merchantShop='1';document.body.appendChild(s);const r=document.createElement('script');r.src='merchant-recommendations.js?v=20260912-1';r.dataset.merchantRecommendations='1';document.body.appendChild(r)}
  function loadProductDetail(){if(document.querySelector('script[data-product-detail]'))return;const s=document.createElement('script');s.src='product-detail.js?v=20260913-1';s.dataset.productDetail='1';document.body.appendChild(s)}
  function mount(){
    loadProductDetail();
    if(new URLSearchParams(location.search).get('shop')){loadMerchantShop();return;}
    if(document.querySelector('#merchantDirectory'))return;
    const shop=document.querySelector('#shopView');
    if(!shop)return;
    const sec=document.createElement('section');sec.id='merchantDirectory';sec.className='merchant-directory';
    sec.innerHTML='<div class="page-head"><div><p class="eyebrow">HÄNDLER</p><h2>Unsere Händler</h2><p>Entdecke unabhängige Shops auf Zorqemi.</p></div><span id="merchantCount" class="muted"></span></div><div class="merchant-tools"><input id="merchantSearch" type="search" placeholder="Händler suchen …" aria-label="Händler suchen"><select id="merchantSort" aria-label="Händler sortieren"><option value="name">Name A–Z</option><option value="nameDesc">Name Z–A</option></select></div><div id="merchantGrid" class="merchant-grid"><p class="muted">Händler werden geladen …</p></div>';
    shop.parentNode.appendChild(sec);
    const style=document.createElement('style');style.textContent='.merchant-directory{max-width:1180px;margin:55px auto 80px;padding:0 20px}.merchant-tools{display:grid;grid-template-columns:1fr 190px;gap:12px;margin:0 0 20px}.merchant-tools input,.merchant-tools select{width:100%;border:1px solid #d7d0e2;border-radius:11px;background:#ffffffd9;padding:12px;font:inherit;outline:none}.merchant-tools input:focus,.merchant-tools select:focus{border-color:var(--purple);box-shadow:0 0 0 3px #7d4dff1c}.merchant-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.merchant-card{border:1px solid #ddd;border-radius:22px;padding:22px;background:rgba(255,255,255,.8);box-shadow:0 10px 30px rgba(20,15,35,.06);display:flex;flex-direction:column}.merchant-card-top{display:flex;gap:16px;align-items:center}.merchant-avatar{width:72px;height:72px;border-radius:18px;background:#d7ff18;display:grid;place-items:center;font-size:28px;font-weight:900;color:#121016;overflow:hidden;flex:0 0 auto}.merchant-avatar img{width:100%;height:100%;object-fit:contain}.merchant-card h3{margin:0}.merchant-card p{min-height:42px;flex:1}.merchant-card .primary{display:inline-flex;text-decoration:none;justify-content:center}.merchant-badge{font-size:11px;letter-spacing:.12em;font-weight:800;color:#79b900}.merchant-directory .page-head{margin-bottom:20px}.merchant-empty{text-align:center;padding:30px;border:1px dashed #d7d0e2;border-radius:16px;background:#ffffff99}.merchant-empty strong{display:block;margin-bottom:5px}@media(max-width:600px){.merchant-tools{grid-template-columns:1fr}}';document.head.appendChild(style);
    document.querySelector('#merchantSearch').addEventListener('input',render);
    document.querySelector('#merchantSort').addEventListener('change',render);
    load();
  }
  function render(){
    const grid=document.querySelector('#merchantGrid'),count=document.querySelector('#merchantCount');
    if(!grid)return;
    const q=(document.querySelector('#merchantSearch')?.value||'').trim().toLowerCase();
    const sort=document.querySelector('#merchantSort')?.value||'name';
    const rows=merchants.filter(m=>`${m.shop_name||''} ${m.description||''}`.toLowerCase().includes(q)).slice().sort((a,b)=>{const x=(a.shop_name||'').localeCompare(b.shop_name||'','de');return sort==='nameDesc'?-x:x});
    count.textContent=`${rows.length} ${rows.length===1?'Händler':'Händler'}`;
    grid.innerHTML=rows.map(m=>{const publicSlug=String(m.shop_slug||m.slug||'').trim().toLowerCase();const href=publicSlug?`${location.origin}${location.pathname}?shop=${encodeURIComponent(publicSlug)}`:'#shop';const img=m.logo_url?`<img src="${esc(m.logo_url)}" alt="${esc(m.shop_name)} Logo">`:'ZQ';return `<article class="merchant-card"><div class="merchant-card-top"><div class="merchant-avatar">${img}</div><div><div class="merchant-badge">VERÖFFENTLICHT</div><h3>${esc(m.shop_name)}</h3></div></div><p>${esc(m.description||'Händler-Shop auf Zorqemi.')}</p><a class="primary" href="${esc(href)}">Shop ansehen →</a></article>`}).join('')||'<div class="merchant-empty"><strong>Keine Händler gefunden.</strong><span class="muted">Versuche einen anderen Suchbegriff.</span></div>';
  }
  async function load(){
    const grid=document.querySelector('#merchantGrid');
    try{
      const response=await fetch('/api/v1/marketplace/merchants',{headers:{Accept:'application/json'}});
      const payload=await response.json().catch(()=>({}));
      if(response.ok&&payload?.ok&&Array.isArray(payload.merchants)){merchants=payload.merchants;render();return;}
    }catch(error){console.warn('Zorqemi merchant API unavailable, using legacy directory',error)}
    const {data,error}=await db.from('public_merchants').select('id,shop_name,slug,status,description,logo_url,shop_url').order('shop_name',{ascending:true});
    if(error){console.error(error);grid.innerHTML='<div class="merchant-empty"><strong>Händler konnten nicht geladen werden.</strong><span class="muted">Bitte später erneut versuchen.</span></div>';return}
    merchants=data||[];render();
  }
  function loadFilterScript(){if(new URLSearchParams(location.search).get('shop'))return;if(document.querySelector('script[data-marketplace-filters]'))return;const s=document.createElement('script');s.src='marketplace-filters.js';s.dataset.marketplaceFilters='1';document.body.appendChild(s)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(mount,700);setTimeout(loadFilterScript,1200)});else{setTimeout(mount,700);setTimeout(loadFilterScript,1200)}
})();
