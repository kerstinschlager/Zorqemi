(()=>{
  function showRegistration(){
    const modal=document.getElementById('authModal');
    if(!modal)return;
    modal.classList.remove('hidden');
    modal.style.setProperty('display','grid','important');
    window.setZqAuthContext?.('merchant');
    if(typeof window.setAuthMode==='function')window.setAuthMode('signup');
    else {
      const switchButton=document.getElementById('authSwitch');
      if(switchButton && /konto erstellen/i.test(switchButton.textContent||''))switchButton.click();
    }
    document.getElementById('authEmail')?.focus();
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('button,a');
    if(!button || button.closest('#authModal'))return;
    const label=(button.textContent||'').trim();
    if(button.matches('[data-become-merchant],[data-recruit-merchant]') || /^(?:jetzt\s+)?händler\s+werden(?:\s*[→➜])?$/i.test(label)){
      event.preventDefault();event.stopImmediatePropagation();showRegistration();
    }
  },true);
})();
