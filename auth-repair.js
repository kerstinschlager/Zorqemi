(()=>{
  function notify(message){try{window.toast?.(message)}catch(e){}}
  window.zqLoginNow=async function(event){
    try{event?.preventDefault();event?.stopPropagation();event?.stopImmediatePropagation?.();}catch(_){}
    const email=(document.getElementById('authEmail')?.value||'').trim();
    const password=document.getElementById('authPassword')?.value||'';
    const submit=document.getElementById('authSubmit');
    if(!email||password.length<10){notify('Bitte E-Mail und Passwort eingeben (mindestens 10 Zeichen).');return false;}
    if(submit){submit.disabled=true;submit.textContent='Anmeldung …';}
    try{
      const response=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'include',body:JSON.stringify({email,password})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!payload?.user)throw new Error(payload?.error==='invalid_credentials'?'E-Mail oder Passwort ist falsch.':'Anmeldung momentan nicht möglich.');
      document.getElementById('authModal')?.classList.add('hidden');
      document.getElementById('authStatus').textContent=payload.user.email||email;
      const btn=document.getElementById('authBtn');if(btn)btn.textContent='Abmelden';
      if(typeof window.refreshAuth==='function')await window.refreshAuth();
      if(typeof window.zqOpenDashboard==='function')await window.zqOpenDashboard();
      notify('Erfolgreich angemeldet');
    }catch(err){notify('Anmeldung fehlgeschlagen: '+String(err?.message||'Unbekannter Fehler'));}finally{if(submit){submit.disabled=false;submit.textContent='Anmelden';}}
    return false;
  };
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
    if(!e.target||e.target.id!=='authForm')return;
    const modeText=String(document.getElementById('authTitle')?.textContent||'').trim().toLowerCase();
    if(modeText && modeText!=='anmelden')return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const email=(document.getElementById('authEmail')?.value||'').trim();
    const password=document.getElementById('authPassword')?.value||'';
    if(!email||password.length<10){notify('Bitte E-Mail und Passwort eingeben (mindestens 10 Zeichen).');return false;}
    const submit=document.getElementById('authSubmit');
    if(submit){submit.disabled=true;submit.textContent='Anmeldung …';}
    try{
      const serverResult=await window.serverFetch?.('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      if(serverResult?.response?.ok&&serverResult?.payload?.user){
        document.getElementById('authModal')?.classList.add('hidden');
        if(typeof window.refreshAuth==='function')await window.refreshAuth();
        notify('Erfolgreich angemeldet');
        if(typeof window.zqOpenDashboard==='function')await window.zqOpenDashboard();
        return false;
      }
      const db=window.zqDb;
      if(!db)throw new Error(serverResult?.payload?.error||'Anmeldung momentan nicht möglich');
      const {data,error}=await db.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data?.user)throw new Error('Keine Benutzer-Session erhalten.');
      document.getElementById('authModal')?.classList.add('hidden');
      if(typeof window.refreshAuth==='function')await window.refreshAuth();
      const {data:profile}=await db.from('profiles').select('role').eq('id',data.user.id).maybeSingle();
      if(profile?.role==='admin')window.zqOpenAdmin?.();else if(typeof window.zqOpenDashboard==='function')await window.zqOpenDashboard();
      notify(profile?.role==='admin'?'Angemeldet – Adminbereich geöffnet.':'Erfolgreich angemeldet');
    }catch(err){
      console.error('Zorqemi login failed',err);
      notify('Anmeldung fehlgeschlagen: '+String(err?.message||'Ungültige Anmeldedaten'));
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
    }
  }
  window.zqOpenMerchantLogin=openMerchantLogin;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  setTimeout(bind,300);setTimeout(bind,1000);
})();