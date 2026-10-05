(()=>{
  function openMerchantLogin(){
    const modal=document.getElementById('authModal');
    if(!modal)return;
    modal.classList.remove('hidden');
    modal.style.setProperty('display','grid','important');
    if(typeof window.setZqAuthContext==='function')window.setZqAuthContext('merchant');
    if(typeof window.setAuthMode==='function')window.setAuthMode('login');
    setTimeout(()=>document.getElementById('authEmail')?.focus(),50);
  }
  function bind(){
    const btn=document.getElementById('authBtn');
    if(!btn)return;
    if(btn.dataset.zqAuthRepair==='2')return;
    btn.dataset.zqAuthRepair='2';
    btn.addEventListener('click',e=>{
      const label=String(btn.textContent||'').trim().toLowerCase();
      if(label!=='abmelden'){e.preventDefault();e.stopImmediatePropagation();openMerchantLogin();}
    },true);
    document.addEventListener('click',e=>{
      const t=e.target?.closest?.('#authBtn');
      if(t!==btn)return;
      const label=String(btn.textContent||'').trim().toLowerCase();
      if(label!=='abmelden'){e.preventDefault();e.stopImmediatePropagation();openMerchantLogin();}
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  setTimeout(bind,300);setTimeout(bind,1000);setTimeout(bind,2000);
})();