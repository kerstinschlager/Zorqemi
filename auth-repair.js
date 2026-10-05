(()=>{
  let bound=false;
  function supa(){
    if(!window.supabase)return null;
    return window.supabase.createClient(
      window.__RK_SUPABASE_URL||'https://oansbivjkczjbtxaknks.supabase.co',
      window.__RK_SUPABASE_KEY,
      {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'zq-admin-auth'}}
    );
  }
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
    const form=e.target;
    if(!form||form.id!=='authForm'||bound===false)return;
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
      const client=supa();
      if(!client)throw new Error('Supabase ist nicht geladen.');
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      const user=data?.user;
      if(!user)throw new Error('Keine Benutzer-Session erhalten.');
      window.currentUser=user;
      document.getElementById('authStatus').textContent=user.email||email;
      const authBtn=document.getElementById('authBtn');
      if(authBtn)authBtn.textContent='Abmelden';
      document.getElementById('authModal')?.classList.add('hidden');
      let isAdmin=false;
      try{
        const {data:profile}=await client.from('profiles').select('role').eq('id',user.id).maybeSingle();
        isAdmin=profile?.role==='admin';
      }catch(err){console.warn('profile admin check failed',err)}
      if(isAdmin){
        if(window.zqCheckAdmin)await window.zqCheckAdmin(user);
        window.zqOpenAdmin?.();
      }
      window.toast?.(isAdmin?'Erfolgreich angemeldet – Adminzugriff aktiv.':'Erfolgreich angemeldet');
    }catch(err){
      console.error('Zorqemi login failed',err);
      const msg=String(err?.message||err?.error_description||'Anmeldung fehlgeschlagen');
      window.toast?.('Anmeldung fehlgeschlagen: '+msg);
    }finally{
      if(submit){submit.disabled=false;submit.textContent='Anmelden';}
    }
    return false;
  }
  function bind(){
    if(!document.getElementById('authForm'))return;
    bound=true;
    document.getElementById('authForm').addEventListener('submit',handleSubmit,true);
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