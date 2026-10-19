(()=>{
  function notify(message){try{window.toast?.(message)}catch(e){}}
  window.zqLoginNow=async function(event){
    try{event?.preventDefault();event?.stopPropagation();event?.stopImmediatePropagation?.();}catch(_){}
    const email=(document.getElementById('authEmail')?.value||'').trim();
    const password=document.getElementById('authPassword')?.value||'';
    const submit=document.getElementById('authSubmit');
    if(!email||password.length<10){notify('Bitte E-Mail und Passwort eingeben (mindestens 10 Zeichen).');return false;}
    if(submit){submit.disabled=true;submit.textContent='Anmeldung …';}
    const isCustomer=window.__zqAuthContext==='customer';
    try{
      // Prefer the self-hosted API; fall back to Supabase auth so existing accounts still work.
      let serverUser=null, customer=null, loginError=null;
      try{
        const endpoint=isCustomer?'/api/v1/customer/auth/login':'/api/v1/auth/login';
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'include',body:JSON.stringify({email,password})});
        const payload=await response.json().catch(()=>({}));
        if(response.ok&&(isCustomer?payload?.customer:payload?.user)){
          customer=payload.customer||null;serverUser=payload.user||null;
        }else{loginError=payload?.error||'Anmeldung über den Server nicht möglich';}
      }catch(err){loginError=String(err?.message||'Server nicht erreichbar');}
      if(!serverUser&&!customer){
        if(!window.zqDb)throw new Error(loginError||'Anmeldung momentan nicht möglich.');
        const {data,error}=await window.zqDb.auth.signInWithPassword({email,password});
        if(error)throw error;
        if(!data?.user)throw new Error('Keine Benutzer-Session erhalten.');
        const {data:profile}=await window.zqDb.from('profiles').select('role').eq('id',data.user.id).maybeSingle();
        document.getElementById('authModal')?.classList.add('hidden');
        if(typeof window.refreshAuth==='function')await window.refreshAuth();
        if(profile?.role==='admin'){window.zqOpenAdmin?.();notify('Als Administrator angemeldet.');}
        else if(!isCustomer&&typeof window.zqOpenDashboard==='function'){await window.zqOpenDashboard();notify('Erfolgreich angemeldet');}
        else notify('Erfolgreich angemeldet');
        return false;
      }
      document.getElementById('authModal')?.classList.add('hidden');
      const status=document.getElementById('authStatus');
      if(status)status.textContent=(isCustomer?customer?.email:serverUser?.email)||email;
      const btn=document.getElementById('authBtn');if(btn)btn.textContent='Abmelden';
      if(typeof window.refreshAuth==='function')await window.refreshAuth();
      if(!isCustomer&&serverUser?.role==='admin'){window.zqOpenAdmin?.();notify('Als Administrator angemeldet.');}
      else if(!isCustomer&&typeof window.zqOpenDashboard==='function'){await window.zqOpenDashboard();notify('Erfolgreich angemeldet');}
      else notify('Erfolgreich angemeldet');
    }catch(err){notify('Anmeldung fehlgeschlagen: '+String(err?.message||'Ungültige Anmeldedaten'));}
    finally{if(submit){submit.disabled=false;submit.textContent='Anmelden';}}
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
      const isCustomer=window.__zqAuthContext==='customer';
      const serverResult=await window.serverFetch?.(isCustomer?'/customer/auth/login':'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      if(serverResult?.response?.ok&&(isCustomer?serverResult?.payload?.customer:serverResult?.payload?.user)){
        document.getElementById('authModal')?.classList.add('hidden');
        if(typeof window.refreshAuth==='function')await window.refreshAuth();
        notify('Erfolgreich angemeldet');
        if(!isCustomer&&typeof window.zqOpenDashboard==='function')await window.zqOpenDashboard();
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