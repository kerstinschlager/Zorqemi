(()=>{
  function openMerchantLogin(){
    const modal=document.getElementById('authModal');
    if(!modal)return;
    modal.classList.remove('hidden');
    modal.style.setProperty('display','grid','important');
    const title=document.getElementById('authTitle'); if(title)title.textContent='Anmelden';
    const submit=document.getElementById('authSubmit'); if(submit)submit.textContent='Anmelden';
    const wrap=document.getElementById('authNameWrap'); if(wrap)wrap.classList.add('hidden');
    if(typeof window.setZqAuthContext==='function')window.setZqAuthContext('merchant');
    if(typeof window.setAuthMode==='function')window.setAuthMode('login');
    setTimeout(()=>document.getElementById('authEmail')?.focus(),50);
  }
  function bind(){
    const btn=document.getElementById('authBtn');
    if(btn&&!btn.dataset.zqAuthRepair){
      btn.dataset.zqAuthRepair='1';
      btn.addEventListener('click',e=>{
        const label=String(btn.textContent||'').trim().toLowerCase();
        if(label!=='abmelden'){
          e.preventDefault(); e.stopImmediatePropagation(); openMerchantLogin();
        }
      },true);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  setTimeout(bind,500);setTimeout(bind,1500);
})();