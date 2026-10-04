(function(){
  const URL='https://oansbivkczjbtxaknks.supabase.co';
  const KEY='sb_publishable_9tDZPZ9KmCjHZqVXBmO-1g_8Aqpu8qE';
  const db=window.supabase.createClient(URL,KEY);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);
  let rows=[];
  function mount(){
    const host=location.hostname.toLowerCase().replace(/^www\\./,'');
    if(host.endsWith('.zorqemi.de')&&host!=='zorqemi.de') return;
    const toolbar=document.querySelector('#shopView .toolbar');
    if(!toolbar || document.querySelector('#marketplaceFilters')) return;
    const box=document.createElement('div');
    box.id='marketplaceFilters';
    box.style='display:grid;grid-template-columns:minmax(180px,2fr) repeat(4,minmax(130px,1fr));gap:10px;margin-top:10px;align-items:end';
    box.innerHTML=`<label class="market-filter">Händler<select id="merchantFilter"><option value="all">Alle Händler</option></select></label>
      <label class="market-filter">Kategorie<select id="marketCategory"><option value="all">Alle Kategorien</option></select></label>
      <label class="market-filter">Preis von<input id="minPrice" type="number" min="0" step="0.01" placeholder="0,00"></label>
      <label class="market-filter">Preis bis<input id="maxPrice" type="number" min="0" step="0.01" placeholder="max"></label>
      <button id="resetFilters" class="secondary" type="button">Filter zurücksetzen</button>`;
    toolbar.appendChild(box);
    const s=document.createElement('style');s.textContent='@media(max-width:850px){#marketplaceFilters{grid-template-columns:1fr 1fr!important}}.market-filter{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700}.market-filter input,.market-filter select{min-height:42px;padding:9px 11px;border:1px solid #ddd;border-radius:11px;background:#fff;font:inherit}.market-filter .secondary{min-height:42px}';document.head.appendChild(s);
    ['search','sort','merchantFilter','marketCategory','minPrice','maxPrice'].forEach(id=>document.getElementById(id)?.addEventListener('input',render));
    document.getElementById('resetFilters')?.addEventListener('click',()=>{
      ['search','minPrice','maxPrice'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
      const mf=document.getElementById('merchantFilter'),mc=document.getElementById('marketCategory');if(mf)mf.value='all';if(mc)mc.value='all';
      render();
    });
    load();
  }
  async function load(){
    const {data,error}=await db.from('products').select('id,name,slug,description,price,stock,image_url,created_at,category_id,merchant_id').eq('active',true).order('created_at',{ascending:false});
    if(error){console.error(error);return}
    rows=data||[];
    const merchantIds=[...new Set(rows.map(x=>x.merchant_id).filter(Boolean))];
    const categoryIds=[...new Set(rows.map(x=>x.category_id).filter(Boolean))];
    let merchants={},cats={};
    if(merchantIds.length){const r=await db.from('merchants').select('id,shop_name,status,published').in('id',merchantIds);if(!r.error)(r.data||[]).forEach(m=>{if(m.status==='approved'&&m.published)merchants[m.id]=m.shop_name})}
    if(categoryIds.length){const r=await db.from('categories').select('id,name').in('id',categoryIds);if(!r.error)(r.data||[]).forEach(c=>cats[c.id]=c.name)}
    rows=rows.filter(p=>merchants[p.merchant_id]).map(p=>({...p,merchant:merchants[p.merchant_id],category:cats[p.category_id]||'Produkte'}));
    const mf=document.getElementById('merchantFilter'),mc=document.getElementById('marketCategory');
    if(mf)mf.innerHTML='<option value="all">Alle Händler</option>'+[...new Set(rows.map(p=>p.merchant))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    if(mc)mc.innerHTML='<option value="all">Alle Kategorien</option>'+[...new Set(rows.map(p=>p.category))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    render();
  }
  function render(){
    const grid=document.getElementById('productGrid');if(!grid)return;
    const q=(document.getElementById('search')?.value||'').toLowerCase().trim();
    const merchant=document.getElementById('merchantFilter')?.value||'all';
    const category=document.getElementById('marketCategory')?.value||'all';
    const min=Number(document.getElementById('minPrice')?.value||'');
    const max=Number(document.getElementById('maxPrice')?.value||'');
    let list=rows.filter(p=>{
      const hay=(p.name+' '+(p.description||'')+' '+p.merchant+' '+p.category).toLowerCase();
      return (!q||hay.includes(q))&&(merchant==='all'||p.merchant===merchant)&&(category==='all'||p.category===category)&&(!min||Number(p.price)>=min)&&(Number.isNaN(max)||!max||Number(p.price)<=max);
    });
    const sort=document.getElementById('sort')?.value||'new';
    if(sort==='priceAsc')list.sort((a,b)=>a.price-b.price);else if(sort==='priceDesc')list.sort((a,b)=>b.price-a.price);else list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    grid.innerHTML=list.map(p=>`<article class="product"><div class="product-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div class="placeholder">RK</div>'}</div><div class="product-body"><div class="muted">${esc(p.merchant)} · ${esc(p.category)}</div><h3>${esc(p.name)}</h3><p class="muted">${esc(p.description||'')}</p><div class="price">${money(p.price)}</div><button class="add" ${Number(p.stock)<=0?'disabled':''} onclick="addToCart(${p.id})">${Number(p.stock)>0?'In den Warenkorb':'Ausverkauft'}</button></div></article>`).join('')||'<p>Keine Produkte für diese Filter gefunden.</p>';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,1000));else setTimeout(mount,1000);
})();
