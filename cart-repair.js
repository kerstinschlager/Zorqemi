(()=>{
  function openCart(e){
    if(e){e.preventDefault();e.stopImmediatePropagation();}
    const modal=document.getElementById('cartModal');
    if(!modal)return;
    modal.classList.remove('hidden');
    if(typeof window.renderCart==='function')window.renderCart();
  }
  function bind(){
    const btn=document.getElementById('cartBtn');
    if(btn&&!btn.dataset.zqCartRepair){
      btn.dataset.zqCartRepair='1';
      btn.addEventListener('click',openCart,true);
    }
  }
  function repairProductButtons(){
    document.querySelectorAll('.product .add[data-zq-product-id]').forEach(btn=>{
      if(btn.dataset.zqCartButtonRepair)return;
      btn.dataset.zqCartButtonRepair='1';
      btn.addEventListener('click',e=>{
        e.preventDefault();e.stopImmediatePropagation();
        const id=btn.dataset.zqProductId;
        if(id&&typeof window.addToCart==='function')window.addToCart(id);
      },true);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind();repairProductButtons()});else{bind();repairProductButtons()}
  setInterval(()=>{bind();repairProductButtons()},500);
})();