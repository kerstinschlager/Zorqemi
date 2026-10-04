(function(){
  const URL='https://oansbivjkczjbtxaknks.supabase.co';
  const KEY='sb_publishable_9tDZPZ9KmCjHZqVXBmO-1g_8Aqpu8qE';
  const db=window.supabase.createClient(URL,KEY);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=v=>{try{const u=new URL(String(v||''),location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch(e){return ''}};
  const safeColor=v=>{const s=String(v||'').trim();return /^#[0-9a-fA-F]{3,8}$/.test(s)?s:''};
  const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);
  const params=new URLSearchParams(location.search),querySlug=params.get('shop');
  async function init(){
    const shopView=document.querySelector('#shopView'),grid=document.querySelector('#productGrid');
    if(!shopView||!grid)return;
    const host=location.hostname.toLowerCase().replace(/^www\./,'');
    let merchant=null, merchantProducts=null;
    if(host.endsWith('.zorqemi.de') && host!=='zorqemi.de'){
      try{
        const [sr,pr]=await Promise.all([
          fetch('/api/v1/shop',{headers:{Accept:'application/json'}}),
          fetch('/api/v1/shop/products',{headers:{Accept:'application/json'}})
        ]);
        const sp=await sr.json().catch(()=>({})), pp=await pr.json().catch(()=>({}));
        if(sr.ok&&sp?.ok&&sp.shop){
          merchant={...sp.shop,shop_name:sp.shop.name||sp.shop.shop_name||sp.shop.shop_slug,slug:sp.shop.slug||sp.shop.shop_slug};
          merchantProducts=Array.isArray(pp.products)?pp.products:null;
        }
      }catch(e){console.warn('merchant subdomain API unavailable',e)}
    } else {
      const slug=String(querySlug||'').trim().toLowerCase();
      if(!slug)return;
      try{
        const r=await fetch('/api/v1/marketplace/merchants',{headers:{Accept:'application/json'}});
        const p=await r.json().catch(()=>({}));
        if(r.ok&&p?.ok&&Array.isArray(p.merchants)){
          const m=p.merchants.find(x=>String(x.shop_slug||x.slug||'').toLowerCase()===slug);
          if(m)merchant={...m,shop_name:m.shop_name||m.name,slug:m.slug||m.shop_slug};
          if(merchant){
            const pr=await fetch('/api/v1/marketplace/products',{headers:{Accept:'application/json'}});
            const pp=await pr.json().catch(()=>({}));
            if(pr.ok&&pp?.ok&&Array.isArray(pp.products)) merchantProducts=pp.products.filter(x=>String(x.merchant_id)===String(merchant.id));
          }
        }
      }catch(e){console.warn('merchant marketplace API unavailable',e)}
    }
    if(!merchant){
      const slug=String(querySlug||'').trim().toLowerCase();
      if(slug){
        const {data,error}=await db.from('public_merchants').select('id,shop_name,slug,description,logo_url,shop_url').eq('slug',slug).maybeSingle();
        if(!error)merchant=data||null;
      }
    }
    if(!merchant){document.title='Händler-Shop | Zorqemi';grid.innerHTML='<div class="merchant-shop-empty"><strong>Dieser Händler-Shop ist nicht verfügbar.</strong><span>Der Link ist möglicherweise abgelaufen oder der Shop wurde nicht veröffentlicht.</span><a class="secondary" href="'+esc(location.pathname)+'#shop">← Zur Händlerübersicht</a></div>';return;}
    document.title=`${merchant.shop_name} | Zorqemi`;
    let meta=document.querySelector('meta[name="description"]');
    if(!meta){meta=document.createElement('meta');meta.name='description';document.head.appendChild(meta)}
    meta.content=`${merchant.shop_name} – Produkte und Angebote auf Zorqemi. ${merchant.description||''}`.slice(0,160);

    let site={};
    try{const r=await db.rpc('public_merchant_site_content',{p_slug:slug});site=(Array.isArray(r.data)?r.data[0]:r.data)||{}}catch(e){}
    const theme=String(site.theme||'modern').toLowerCase().replace(/[^a-z]/g,'')||'modern';
    const primary=safeColor(site.primary_color),secondary=safeColor(site.secondary_color);
    document.body.classList.add('theme-'+theme);
    const external=safeUrl(merchant.shop_url);
    const hero=shopView.querySelector('.hero');
    if(hero){
      const title=site.hero_title||merchant.shop_name;
      const text=site.hero_text||merchant.description||'Entdecke die Produkte dieses Händlers auf Zorqemi.';
      hero.classList.add('merchant-custom-hero');
      hero.style.setProperty('--merchant-primary',primary||'');hero.style.setProperty('--merchant-secondary',secondary||'');
      hero.innerHTML=`<div class="merchant-custom-copy"><p class="eyebrow">HÄNDLER-SHOP</p><h1>${esc(title)}</h1><p>${esc(text)}</p><div class="merchant-shop-actions"><a class="secondary" href="${esc(location.pathname)}#shop">← Händlerübersicht</a>${external?`<a class="secondary" href="${esc(external)}" target="_blank" rel="noopener noreferrer">Externe Shop-Website öffnen</a>`:''}</div></div>${site.banner_url?`<div class="merchant-banner"><img src="${esc(safeUrl(site.banner_url))}" alt="${esc(title)}"></div>`:`<div class="hero-card merchant-shop-logo">${merchant.logo_url?`<img src="${esc(merchant.logo_url)}" alt="${esc(merchant.shop_name)} Logo">`:'RK'}</div>`}`;
    }
    const blocks=Array.isArray(site.blocks)?site.blocks:[];
    if(blocks.length){
      const blockWrap=document.createElement('section');blockWrap.className='merchant-content-blocks';
      blockWrap.innerHTML=blocks.map(b=>`<article><h3>${esc(typeof b==='string'?b:(b?.title||''))}</h3>${typeof b==='object'&&b?.text?`<p>${esc(b.text)}</p>`:''}</article>`).join('');
      const toolbar=shopView.querySelector('.toolbar');if(toolbar)toolbar.parentNode.insertBefore(blockWrap,toolbar);else shopView.appendChild(blockWrap);
    }
    const toolbar=shopView.querySelector('.toolbar');
    if(toolbar&&!toolbar.previousElementSibling?.classList.contains('merchant-shop-title')){const title=document.createElement('div');title.className='merchant-shop-title';title.innerHTML=`<strong>Produkte von ${esc(merchant.shop_name)}</strong>`;toolbar.parentNode.insertBefore(title,toolbar);}
    let products=[];
    if(Array.isArray(merchantProducts)){
      products=merchantProducts.map(p=>({...p,category_id:p.category_id||null}));
    } else {
      const {data:rows,error:prodError}=await db.from('products').select('id,name,slug,description,price,stock,image_url,created_at,category_id').eq('active',true).eq('merchant_id',merchant.id).order('created_at',{ascending:false});
      if(prodError){grid.innerHTML='<div class="merchant-shop-empty"><strong>Produkte konnten nicht geladen werden.</strong><span>Bitte versuche es später erneut.</span></div>';return;}
      products=rows||[];
    }
    const ids=[...new Set(products.map(p=>p.category_id).filter(Boolean))];let cats={};
    if(ids.length){const r=await db.from('categories').select('id,name').in('id',ids);if(!r.error)(r.data||[]).forEach(c=>cats[c.id]=c.name)}
    const render=()=>{
      const q=(document.querySelector('#search')?.value||'').toLowerCase().trim(),cat=document.querySelector('#categoryFilter')?.value||'all',sort=document.querySelector('#sort')?.value||'new';
      let list=products.map(p=>({...p,category:cats[p.category_id]||'Produkte'})).filter(p=>(p.name+' '+(p.description||'')).toLowerCase().includes(q)&&(cat==='all'||p.category===cat));
      if(sort==='priceAsc')list.sort((a,b)=>a.price-b.price);else if(sort==='priceDesc')list.sort((a,b)=>b.price-a.price);
      grid.innerHTML=list.map(p=>`<article class="product">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div class="placeholder">RK</div>'}<div class="product-body"><div class="muted">${esc(p.category)}</div><h3>${esc(p.name)}</h3><p class="muted">${esc(p.description||'')}</p><div class="price">${money(p.price)}</div><button class="add" ${Number(p.stock)<=0?'disabled':''} onclick="addToCart(${p.id})">${Number(p.stock)>0?'In den Warenkorb':'Ausverkauft'}</button></div></article>`).join('')||'<div class="merchant-shop-empty"><strong>Keine passenden Produkte.</strong><span>Dieser Händler hat für diese Auswahl keine Produkte.</span></div>';
    };
    const cf=document.querySelector('#categoryFilter');
    if(cf){const values=[...new Set(products.map(p=>cats[p.category_id]||'Produkte'))].sort();cf.innerHTML='<option value="all">Alle Kategorien</option>'+values.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');}
    ['search','categoryFilter','sort'].forEach(id=>document.querySelector('#'+id)?.addEventListener('input',render));
    const dir=document.querySelector('#merchantDirectory');if(dir)dir.remove();
    const style=document.createElement('style');style.textContent=`
      .merchant-shop-title{max-width:1180px;margin:28px auto -35px;padding:0 20px;font-size:18px}
      .merchant-shop-logo{overflow:hidden}.merchant-shop-logo img{width:100%;height:100%;object-fit:contain;border-radius:16px}
      .merchant-custom-hero{--merchant-primary:#7d4dff;--merchant-secondary:#c8ff24}
      .merchant-custom-hero h1{color:var(--merchant-primary)}
      .merchant-custom-hero .secondary:hover{border-color:var(--merchant-primary)}
      .merchant-banner{min-height:180px;max-height:340px;overflow:hidden;border-radius:18px;background:var(--merchant-secondary);display:flex;align-items:center;justify-content:center}
      .merchant-banner img{width:100%;height:100%;max-height:340px;object-fit:cover;display:block}
      .merchant-content-blocks{max-width:1180px;margin:24px auto;padding:0 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
      .merchant-content-blocks article{padding:18px;border:1px solid #e0d8e8;border-radius:15px;background:#fff}
      .merchant-content-blocks h3{margin:0 0 7px}.merchant-content-blocks p{margin:0;color:#6f6878}
      .merchant-shop-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.merchant-shop-actions a{text-decoration:none}
      .merchant-shop-empty{padding:32px 20px;margin:20px 0;border:1px dashed #d7d0e2;border-radius:16px;background:#ffffffb8;text-align:center}.merchant-shop-empty strong{display:block;margin-bottom:6px}.merchant-shop-empty span{display:block;color:#6f6878;margin-bottom:15px}.merchant-shop-empty a{display:inline-block;text-decoration:none}
      body.theme-modern{--rk-theme-accent:#7d4dff;--rk-theme-soft:#f3efff;--rk-theme-bg:#fbfaff;--rk-theme-radius:18px}
      body.theme-elegant{--rk-theme-accent:#8b6b4a;--rk-theme-soft:#f4eee7;--rk-theme-bg:#fcfaf7;--rk-theme-radius:10px}
      body.theme-minimal{--rk-theme-accent:#555;--rk-theme-soft:#f1f1f1;--rk-theme-bg:#fff;--rk-theme-radius:6px}
      body.theme-dark{--rk-theme-accent:#a78bfa;--rk-theme-soft:#24212c;--rk-theme-bg:#15131b;--rk-theme-radius:14px}
      body.theme-nature{--rk-theme-accent:#4f7c5a;--rk-theme-soft:#edf4e9;--rk-theme-bg:#f8fbf5;--rk-theme-radius:18px}
      body.theme-lifestyle{--rk-theme-accent:#e05a7a;--rk-theme-soft:#fff0f4;--rk-theme-bg:#fffafb;--rk-theme-radius:20px}
      body.theme-business{--rk-theme-accent:#2563eb;--rk-theme-soft:#edf3ff;--rk-theme-bg:#f8faff;--rk-theme-radius:8px}
      body.theme-creative{--rk-theme-accent:#db2777;--rk-theme-soft:#fff0f7;--rk-theme-bg:#fff9fc;--rk-theme-radius:22px}
      body.theme-shop{--rk-theme-accent:#0f766e;--rk-theme-soft:#e8f7f5;--rk-theme-bg:#f7fcfb;--rk-theme-radius:12px}
      body.theme-custom{--rk-theme-accent:#7d4dff;--rk-theme-soft:#f3efff;--rk-theme-bg:#fbfaff;--rk-theme-radius:16px}
      body.theme-dark .merchant-custom-hero,body.theme-dark .merchant-content-blocks article,body.theme-dark .merchant-shop-empty{background:#211e29;color:#f7f5fb;border-color:#3b3548}
      body.theme-dark .merchant-content-blocks p,body.theme-dark .merchant-shop-empty span{color:#c7c1d2}
      body.theme-dark .merchant-shop-title,body.theme-dark .muted{color:#ddd7e7}
      body.theme-modern .merchant-custom-hero,body.theme-elegant .merchant-custom-hero,body.theme-minimal .merchant-custom-hero,body.theme-nature .merchant-custom-hero,body.theme-lifestyle .merchant-custom-hero,body.theme-business .merchant-custom-hero,body.theme-creative .merchant-custom-hero,body.theme-shop .merchant-custom-hero,body.theme-custom .merchant-custom-hero{border-top:5px solid var(--rk-theme-accent);border-radius:var(--rk-theme-radius);background:linear-gradient(135deg,var(--rk-theme-soft),#fff)}
      body.theme-dark .merchant-custom-hero{border-top:5px solid var(--rk-theme-accent);border-radius:var(--rk-theme-radius)}
      body.theme-dark{background:var(--rk-theme-bg)}
      body.theme-dark .product,body.theme-dark .toolbar{background:#211e29!important;border-color:#3b3548!important;color:#f7f5fb}
      body.theme-dark .product .muted{color:#c7c1d2}
      body.theme-dark .product .add{background:var(--rk-theme-accent);color:#17131e;border-color:var(--rk-theme-accent)}
      .merchant-custom-hero .secondary:hover{color:var(--rk-theme-accent)}
      .product .add{border-radius:var(--rk-theme-radius);border-color:var(--rk-theme-accent)}
      .product .price{color:var(--rk-theme-accent)}
      .merchant-content-blocks article{border-radius:var(--rk-theme-radius);background:var(--rk-theme-bg)}
      @media(max-width:700px){.merchant-content-blocks{grid-template-columns:1fr}.merchant-banner{min-height:140px}}
    `;document.head.appendChild(style);
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1300));else setTimeout(init,1300);
})();
