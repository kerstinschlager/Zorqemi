(()=>{
  let busy=false;
  const getCart=()=>{try{const x=JSON.parse(localStorage.getItem('rebel_cart')||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
  const toastMsg=t=>{if(typeof window.toast==='function')window.toast(t);else alert(t)};
  async function start(){
    if(busy)return;
    const raw=getCart();
    if(!raw.length){toastMsg('Warenkorb ist leer.');return}
    const email=String(document.getElementById('checkoutEmail')?.value||'').trim();
    const name=String(document.getElementById('checkoutName')?.value||'').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toastMsg('Bitte eine gültige E-Mail-Adresse eingeben.');return}
    busy=true;
    const b=document.querySelector('#checkoutForm button[type="submit"],#checkoutForm button[data-zq-direct-checkout]');
    if(b){b.disabled=true;b.textContent='Weiter zu Stripe …'}
    try{
      const key=crypto.randomUUID();
      const r=await fetch('/api/v1/checkout/session',{
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({
          items:raw.map(x=>({product_id:String(x.id),variant_id:x.variantId?String(x.variantId):null,quantity:Number(x.qty)})),
          idempotency_key:key,
          customer_name:name,
          customer_email:email,
          success_url:location.origin+location.pathname+'?payment=success&session_id={CHECKOUT_SESSION_ID}',
          cancel_url:location.origin+location.pathname+'?payment=cancelled'
        })
      });
      const p=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(p?.error||'Stripe Checkout konnte nicht gestartet werden.');
      if(!p?.checkout?.url)throw new Error('Keine Stripe-Checkout-URL erhalten.');
      window.location.assign(p.checkout.url);
    }catch(e){
      console.error('direct stripe checkout failed',e);
      toastMsg(e?.message||'Stripe Checkout konnte nicht gestartet werden.');
      if(b){b.disabled=false;b.textContent='Mit Stripe bezahlen'}
      busy=false;
    }
  }
  window.zqDirectStripePay=start;
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#checkoutForm button[type="submit"],#checkoutForm button[data-zq-direct-checkout]');
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    start();
  },true);
  document.addEventListener('DOMContentLoaded',()=>{
    const b=document.querySelector('#checkoutForm button[type="submit"]');
    if(b){b.dataset.zqDirectCheckout='1';b.type='button'}
  });
})();