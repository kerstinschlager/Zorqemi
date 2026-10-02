(function(){
  const URL=window.__RK_SUPABASE_URL||'https://oansbivjkczjbtxaknks.supabase.co';
  const KEY=window.__RK_SUPABASE_KEY;
  if(!window.supabase||!KEY)return;
  const db=window.supabase.createClient(URL,KEY);
  let busy=false;
  async function apply(theme){
    if(busy)return;
    busy=true;
    try{
      const {data:{user}}=await db.auth.getUser();
      if(!user)return;
      const {data:m,error:me}=await db.from('merchants').select('*').eq('owner_id',user.id).maybeSingle();
      if(me||!m){if(typeof toast==='function')toast('Händler-Shop konnte nicht geladen werden');return;}
      const {data,error}=await db.rpc('merchant_set_theme',{p_merchant_id:m.id,p_theme:theme});
      if(error){console.error(error);if(typeof toast==='function')toast('Design konnte nicht übernommen werden');return;}
      const hint=document.querySelector('#themeHint');
      if(hint)hint.innerHTML='✓ <strong>'+themeName(theme)+'</strong> übernommen. Jetzt kannst du deine Webseite gestalten.';
      const editor=document.querySelector('#siteEditor');
      if(editor){editor.scrollIntoView({behavior:'smooth',block:'start'});return;}
      let tries=0; const reveal=()=>{const ed=document.querySelector('#siteEditor'); if(ed){ed.classList.add('zq-editor-ready'); ed.scrollIntoView({behavior:'smooth',block:'start'}); const h=document.querySelector('#themeHint'); if(h) h.innerHTML='✓ <strong>'+themeName(theme)+'</strong> übernommen. Deine Webseite ist jetzt bereit zur Bearbeitung.'; return;} if(++tries<20)setTimeout(reveal,250)}; setTimeout(reveal,100);
    }finally{busy=false;}
  }
  function themeName(id){return ({modern:'Modern',elegant:'Elegant',minimal:'Minimalistisch',dark:'Dark',nature:'Natur',lifestyle:'Lifestyle',business:'Business',creative:'Kreativ',shop:'Shop',custom:'Individuell'})[id]||id;}
  function wire(){
    document.addEventListener('click',e=>{
      const card=e.target.closest('#themeGrid .theme-card[data-theme]');
      if(!card)return;
      const id=card.dataset.theme;
      setTimeout(()=>apply(id),20);
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
