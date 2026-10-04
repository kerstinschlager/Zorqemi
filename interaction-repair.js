(()=>{
  function cartRead(){try{const x=JSON.parse(localStorage.getItem('rebel_cart')||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
  function cartWrite(a){localStorage.setItem('rebel_cart',JSON.stringify(a));const c=a.reduce((s,i)=>s+(Number(i.qty)||0),0);const e=document.getElementById('cartCount');if(e)e.textContent=String(c)}
  function closeModal(id){
    const m=document.getElementById(id);if(!m)return;
    m.classList.add('hidden');m.style.removeProperty('display');m.style.removeProperty('pointer-events');
  }
  document.addEventListener('click',e=>{
    const close=e.target.closest?.('[data-close]');
    if(close){
      const id=close.getAttribute('data-close');
      if(id){e.preventDefault();e.stopImmediatePropagation();closeModal(id);return;}
    }
    const add=e.target.closest?.('.product .add');
    if(add && !add.disabled && add.dataset.zqProductId){
      e.preventDefault();e.stopImmediatePropagation();
      const id=String(add.dataset.zqProductId);
      const stock=Number(add.dataset.zqProductStock)||Number((window.zqPublicShopProducts||[]).find(p=>String(p.id)===id)?.stock)||0;
      if(stock<1){window.toast?.('Produkt ist nicht verfügbar.');return;}
      const a=cartRead();const i=a.find(x=>String(x.id)===id&&!x.variantId);
      const next=(Number(i?.qty)||0)+1;
      if(next>stock){window.toast?.('Nicht mehr auf Lager');return;}
      if(i)i.qty=next;else a.push({id,qty:1});
      cartWrite(a);window.toast?.('Produkt hinzugefügt');
    }
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal('cartModal');closeModal('authModal');closeModal('checkoutModal');}});
})();