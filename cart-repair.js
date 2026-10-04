(()=>{
  const toast=t=>{if(typeof window.toast==='function')window.toast(t);};
  function getCart(){try{return JSON.parse(localStorage.getItem('rebel_cart')||'[]')}catch{return[]}}
  function saveCart(c){localStorage.setItem('rebel_cart',JSON.stringify(c))}
  function countCart(c){const n=c.reduce((s,i)=>s+(Number(i.qty)||0),0);const e=document.getElementById('cartCount');if(e)e.textContent=String(n);return n}
  function openCart(e){
    if(e){e.preventDefault();e.stopImmediatePropagation();}
    const modal=document.getElementById('cartModal');
    if(!modal)return;
    modal.classList.remove('hidden');
    if(typeof window.renderCart==='function')window.renderCart();
  }
  function bindCart(){
    const btn=document.getElementById('cartBtn');
    if(btn&&!btn.dataset.zqCartRepair){
      btn.dataset.zqCartRepair='1';
      btn.addEventListener('click',openCart,true);
    }
  }
  function addDirect(id,button){
    const products=Array.isArray(window.zqPublicShopProducts)?window.zqPublicShopProducts:[];
    const p=products.find(x=>String(x.id)===String(id));
    const stock=Number(p?.stock)||0;
    if(!p||stock<1){toast('Produkt ist nicht verfügbar.');return;}
    const cart=getCart();
    const item=cart.find(x=>String(x.id)===String(id)&&!x.variantId);
    const qty=(Number(item?.qty)||0)+1;
    if(qty>stock){toast('Nicht mehr auf Lager');return;}
    if(item)item.qty=qty;else cart.push({id:p.id,qty:1});
    saveCart(cart);countCart(cart);
    toast('Produkt hinzugefügt');
    if(typeof window.renderCart==='function' && !document.getElementById('cartModal')?.classList.contains('hidden'))window.renderCart();
    if(button)button.blur();
  }
  function repairProductButtons(){
    document.querySelectorAll('.product .add[data-zq-product-id]').forEach(btn=>{
      if(btn.dataset.zqCartButtonRepair)return;
      btn.dataset.zqCartButtonRepair='1';
      btn.addEventListener('click',e=>{
        e.preventDefault();e.stopImmediatePropagation();
        addDirect(btn.dataset.zqProductId,btn);
      },true);
    });
  }
  function init(){
    bindCart();repairProductButtons();countCart(getCart());
    setInterval(()=>{bindCart();repairProductButtons()},300);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();