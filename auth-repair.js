(()=>{
  let bound=false;
  function openMerchantLogin(){
    const modal=document.getElementById('authModal');
    if(!modal)return;
    modal.classList.remove('hidden');
    modal.style.setProperty('display','grid','important');
    window.setZqAuthContext?.('merchant');
    window.setAuthMode?.('login');
    setTimeout(()=>document.getElementById('authEmail')?.focus(),50);
  }
  async function handleSubmit(e){
    if(!e.target || e.target.id!=='authForm')return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const email=(document.getElementById('authEmail')?.value||'').trim();
    const password=document.getElementById('authPassword')?.value||'';
    if(!email||password.length<10){
      window.toast?.('Bitte E-Mail und Passwort eingeben (mindestens 10 Zeichen).');
      return false;
    }
    const submit=document.getElementById('authSubmit');
    if(submit){submit.disabled=true;submit.textContent='Anmeldung …';}
    try{
      const client=window.zqDb;
      if(!client)throw new Error('Supabase ist nicht geladen.');
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data?.user)throw new Error('Keine Benutzer-Session erhalten.');
      document.getElementById('authModal')?.classList.add('hidden');
      if(typeof window.refreshAuth==='function'){
        await window.refreshAuth();
      }else{
        const status=document.getElementById('authStatus');
        const btn=document.getElementById('authBtn');
        if(status)status.textContent=data.user.email||email;
        if(btn)btn.textContent='Abmelden';
        if(window.zqCheckAdmin){
          const ok=await window.zqCheckAdmin(data.user);
          if(ok)window.zqOpenAdmin?.();
        }
      }
      window.toast?.('Erfolgreich angemeldet');
    }catch(err){
      console.error('Zorqemi login failed',err);
      const msg=String(err?.message||err?.error_description||'Anmeldung fehlgeschlagen');
      const switchText=document.getElementById('authSwitchText');
      if(switchText)switchText.innerHTML='<span style="color:#b91c1c;font-weight:700">Anmeldung fehlgeschlagen: '+msg.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</span>';
      window.toast?.('Anmeldung fehlgeschlagen: '+msg);
    }finally{
      if(submit){submit.disabled=false;submit.textContent='Anmelden';}
    }
    return false;
  }
  function bind(){
    const form=document.getElementById('authForm');
    if(form&&!form.dataset.zqFinalAuth){
      form.dataset.zqFinalAuth='1';
      form.addEventListener('submit',handleSubmit,true);
      bound=true;
    }
    const btn=document.getElementById('authBtn');
    if(btn&&!btn.dataset.zqAuthRepairFinal){
      btn.dataset.zqAuthRepairFinal='1';
      btn.addEventListener('click',e=>{
        const label=String(btn.textContent||'').trim().toLowerCase();
        if(label!=='abmelden'){e.preventDefault();e.stopImmediatePropagation();openMerchantLogin();}
      },true);
    }
  }
  window.zqOpenMerchantLogin=openMerchantLogin;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  setTimeout(bind,300);setTimeout(bind,1000);setTimeout(bind,2000);
})();