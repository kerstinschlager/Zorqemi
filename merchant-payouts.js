(function(){
  async function loadMerchantPayouts(){
    if(!window.serverSession||!window.merchant||!window.serverFetch)return;
    const host=document.querySelector('#dashboardOverview'); if(!host)return;
    let panel=document.querySelector('#merchantPayoutPanel');
    if(!panel){panel=document.createElement('article');panel.id='merchantPayoutPanel';panel.className='panel';panel.innerHTML='<div class="panel-head"><h3>Auszahlungen</h3><span>Self-hosted</span></div><div id="merchantPayoutBody" class="muted">Lade …</div>';host.appendChild(panel);}
    try{
      const {response,payload}=await window.serverFetch('/merchant/'+encodeURIComponent(window.merchant.id)+'/payouts?limit=20');
      if(!response.ok)throw new Error(payload?.error||'payouts_load_failed');
      const data=payload;
      const b=data.balance||{};
      const rows=data.payouts||[];
      const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);
      const body=document.querySelector('#merchantPayoutBody');
      body.innerHTML='<div class="stats"><div><strong>'+money(b.gross_amount)+'</strong><span>Ausstehender Umsatz</span></div><div><strong>'+money(b.net_amount)+'</strong><span>Voraussichtliche Auszahlung</span></div></div>'+
        (rows.length?rows.map(p=>'<div class="admin-table-row"><div><strong>'+money(p.net_amount)+'</strong><span>'+new Date(p.created_at).toLocaleDateString('de-DE')+' · '+p.order_count+' Bestellungen</span></div><div><small>'+String(p.status)+'</small></div></div>').join(''):'<p class="muted">Noch keine Auszahlungen.</p>');
    }catch(e){const body=document.querySelector('#merchantPayoutBody');if(body)body.textContent='Auszahlungsdaten konnten nicht geladen werden.';}
  }
  const original=window.loadDashboardOverview;
  window.loadMerchantPayouts=loadMerchantPayouts;
  if(typeof original==='function')window.loadDashboardOverview=async function(){await original();await loadMerchantPayouts();};
  document.addEventListener('click',e=>{if(e.target.closest('[data-tab="overview"]'))setTimeout(loadMerchantPayouts,50)});
  setTimeout(loadMerchantPayouts,700);
})();