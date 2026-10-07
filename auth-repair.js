(()=>{
  let bound=false;
  let client=null;
  function getClient(){
    if(client)return client;
    if(window.zqDb)return client=window.zqDb;
    if(!window.supabase)throw new Error('Supabase-Bibliothek ist nicht geladen.');
    const url=window.__RK_SUPABASE_URL||'https://oansbivjkczjbtxaknks.supabase.co';
    const key=window.__RK_SUPABASE_KEY||'';
    if(!key)throw new Error('Supabase-Publishable-Key fehlt.');
    client=window.supabase.createClient(url,key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    return client;
  }
  function notify(message){ try{ if(typeof window.toast==='function') window.toast(message); else if(typeof toast==='function') toast(message); }catch(e){} }
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
    if(modeText && modeText!=='anmelden') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const email=(document.getElementById('authEmail')?.value||'').trim();
    const password=document.getElementById('authPassword')?.value||'';
    if(!email||password.length<10){
      notify('Bitte E-Mail und Passwort eingeben (mindestens 10 Zeichen).');
      return false;
    }
    const submit=document.getElementById('authSubmit');
    if(submit){submit.disabled=true;submit.textContent='Anmeldung …';}
    try{
      if(typeof window.serverFetch==='function'){
        const serverResult=await window.serverFetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
        if(serverResult.response.ok&&serverResult.payload?.user){
          document.getElementById('authStatus').textContent=serverResult.payload.user.email||email;
          const btn=document.getElementById('authBtn');if(btn)btn.textContent='Abmelden';
          document.getElementById('authModal')?.classList.add('hidden');
          if(typeof window.refreshAuth==='function') await window.refreshAuth();
          notify('Erfolgreich angemeldet');
          return false;
        }
      }
      const db=getClient();
      const {data,error}=await db.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data?.user)throw new Error('Keine Benutzer-Session erhalten.');
      const {data:sessionData}=await db.auth.getSession();
      if(!sessionData?.session)throw new Error('Anmeldung war erfolgreich, aber es wurde keine Session gespeichert.');
      const {data:profile,error:profileError}=await db.from('profiles').select('role,display_name').eq('id',data.user.id).maybeSingle();
      if(profileError)console.warn('profile check failed',profileError);
      const isAdmin=profile?.role==='admin';
      document.getElementById('authStatus').textContent=data.user.email||email;
      const btn=document.getElementById('authBtn');if(btn)btn.textContent='Abmelden';
      document.getElementById('authModal')?.classList.add('hidden');
      window.currentUser=data.user;
      window.zqAdminUser=data.user;
      if(typeof window.refreshAuth==='function') await window.refreshAuth();
      if(isAdmin){
        window.zqCheckAdmin?await window.zqCheckAdmin(data.user):null;
        window.zqOpenAdmin?.();
        notify('Angemeldet – Adminbereich geöffnet.');
      }else{
        notify('Erfolgreich angemeldet');
      }
    }    }catch(err){
      console.error('Zorqemi login failed',err);
      const msg=String(err?.message||err?.error_description||'Anmeldung fehlgeschlagen');
      const switchText=document.getElementById('authSwitchText');
      if(switchText)switchText.innerHTML='<span style="color:#b91c1c;font-weight:700">Anmeldung fehlgeschlagen: '+msg.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</span>';
      notify('Anmeldung fehlgeschlagen: '+msg);
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
    const btn=document.getElementById('authBtn');
    if(btn&&!btn.dataset.zqAuthRepairFinal){
      btn.dataset.zqAuthRepairFinal='1';
      btn.addEventListener('click',e=>{
        const label=String(btn.textContent||'').trim().toLowerCase();
        if(label!=='abmelden'){e.preventDefault();e.stopImmediatePropagation();openMerchantLogin();}
      },true);
    }
    bound=true;
  }
  window.zqOpenMerchantLogin=openMerchantLogin;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
  setTimeout(bind,300);setTimeout(bind,1000);setTimeout(bind,2000);
})();