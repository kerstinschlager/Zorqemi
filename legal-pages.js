(()=>{
  const DATA={
    imprint:{
      title:'Impressum',
      html:'<p><strong>Anbieterin:</strong><br>Kerstin Stefanie Schlager<br>Sallauminerstr. 34<br>09385 Lugau<br>Deutschland</p><p><strong>E-Mail:</strong> <a href="mailto:Zorqemi@gmail.com">Zorqemi@gmail.com</a><br><strong>Umsatzsteuer-Identifikationsnummer:</strong> DE318140021</p><p>Zorqemi ist eine Online-Plattform für unabhängige Händler. Für einzelne Kaufverträge ist jeweils der im Angebot ausgewiesene Verkäufer verantwortlich.</p>'
    },
    privacy:{
      title:'Datenschutz',
      html:'<p><strong>Verantwortliche:</strong><br>Kerstin Stefanie Schlager, Sallauminerstr. 34, 09385 Lugau, Deutschland<br><a href="mailto:Zorqemi@gmail.com">Zorqemi@gmail.com</a></p><p>Wir verarbeiten personenbezogene Daten, die für den Betrieb der Plattform, Kundenkonten, Bestellungen, Zahlungsabwicklung, Versand, Support und die Sicherheit des Dienstes erforderlich sind.</p><h3>Zahlungsabwicklung</h3><p>Für Online-Zahlungen wird Stripe eingesetzt. Die für die Zahlungsabwicklung erforderlichen Daten werden an Stripe übermittelt. Die konkrete Verarbeitung durch Stripe richtet sich ergänzend nach den Datenschutzhinweisen von Stripe.</p><h3>Technischer Betrieb</h3><p>Der Plattformbetrieb erfolgt auf einem eigenen Server in Google Cloud. Für Datenbank- und einzelne Plattformdienste wird Supabase eingesetzt.</p><h3>Rechtsgrundlagen</h3><p>Die Verarbeitung erfolgt insbesondere zur Vertragserfüllung, zur Erfüllung gesetzlicher Pflichten sowie – soweit erforderlich – auf Grundlage berechtigter Interessen oder einer Einwilligung.</p><h3>Speicherdauer und Rechte</h3><p>Daten werden nur so lange gespeichert, wie dies für den jeweiligen Zweck erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen. Betroffene Personen haben insbesondere Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und – soweit die Voraussetzungen vorliegen – Widerspruch und Widerruf einer Einwilligung sowie das Recht auf Beschwerde bei einer Datenschutzaufsichtsbehörde.</p>'
    },
    terms:{
      title:'AGB / Nutzungs- und Verkaufsbedingungen',
      html:'<h3>1. Plattform</h3><p>Zorqemi stellt eine technische Online-Plattform bereit, auf der selbständige Händler Produkte und Angebote veröffentlichen können.</p><h3>2. Vertragspartner</h3><p>Der jeweilige Kaufvertrag kommt zwischen dem Kunden und dem im konkreten Angebot ausgewiesenen Händler zustande, soweit Zorqemi nicht ausdrücklich selbst als Verkäufer auftritt.</p><h3>3. Preise und Zahlung</h3><p>Es gelten die im jeweiligen Angebot und im Checkout angezeigten Preise einschließlich der dort ausgewiesenen Steuern und Versandkosten. Die Zahlungsabwicklung erfolgt über den jeweils angebotenen Zahlungsdienst.</p><h3>4. Mängelrechte</h3><p>Für die gesetzlichen Mängelrechte ist grundsätzlich der jeweilige Verkäufer verantwortlich.</p><h3>5. Plattformmissbrauch</h3><p>Die missbräuchliche Nutzung der Plattform, insbesondere betrügerische Bestellungen oder rechtswidrige Inhalte, ist untersagt.</p>'
    },
    withdrawal:{
      title:'Widerrufsbelehrung',
      html:'<p><strong>Widerrufsrecht</strong></p><p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren erhalten haben.</p><p>Um Ihr Widerrufsrecht auszuüben, müssen Sie den jeweiligen Verkäufer mittels einer eindeutigen Erklärung über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.</p><p>Für einen Widerruf können Sie die folgende E-Mail-Adresse verwenden: <a href="mailto:Zorqemi@gmail.com">Zorqemi@gmail.com</a>. Bitte geben Sie nach Möglichkeit Bestellnummer, Name und E-Mail-Adresse an.</p><p>Nach einem wirksamen Widerruf sind die empfangenen Leistungen nach Maßgabe der gesetzlichen Vorschriften zurückzugewähren. Die Einzelheiten, insbesondere zu Rücksendekosten und möglichen gesetzlichen Ausnahmen vom Widerrufsrecht, richten sich nach den jeweils anwendbaren gesetzlichen Vorschriften.</p><h3>Muster-Widerrufsformular</h3><p>An<br>Kerstin Stefanie Schlager<br>Sallauminerstr. 34<br>09385 Lugau<br>E-Mail: Zorqemi@gmail.com</p><p>Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der folgenden Waren: __________<br>Bestellnummer: __________<br>Name: __________<br>Anschrift: __________<br>Datum: __________<br>Unterschrift (nur bei Mitteilung auf Papier): __________</p><p><strong>Hinweis:</strong> Die gesetzlich erforderliche elektronische Widerrufsfunktion und die dazugehörige Eingangsbestätigung sind separat zu implementieren, bevor der Fernabsatzverkauf als vollständig rechtlich umgesetzt angesehen werden sollte.</p>'
    }
  };
  function openLegal(key){
    const modal=document.getElementById('zqLegalModal');if(!modal)return;
    const d=DATA[key];if(!d)return;
    modal.querySelector('[data-legal-title]').textContent=d.title;
    modal.querySelector('[data-legal-body]').innerHTML=d.html;
    modal.classList.remove('hidden');
  }
  function mount(){
    if(document.getElementById('zqLegalModal'))return;
    const footer=document.createElement('footer');footer.id='zqLegalFooter';footer.innerHTML='<div><strong>Zorqemi</strong><span>Online-Marktplatz</span></div><nav><button data-legal="imprint">Impressum</button><button data-legal="privacy">Datenschutz</button><button data-legal="terms">AGB</button><button data-legal="withdrawal">Widerruf</button></nav><small>© '+new Date().getFullYear()+' Zorqemi</small>';
    document.body.appendChild(footer);
    const modal=document.createElement('div');modal.id='zqLegalModal';modal.className='modal hidden';modal.innerHTML='<div class="modal-card"><button class="close" type="button" data-legal-close>×</button><h2 data-legal-title>Rechtliches</h2><div data-legal-body></div></div>';
    document.body.appendChild(modal);
    footer.querySelectorAll('[data-legal]').forEach(b=>b.addEventListener('click',()=>openLegal(b.dataset.legal)));
    modal.querySelector('[data-legal-close]').addEventListener('click',()=>modal.classList.add('hidden'));
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});
    const s=document.createElement('style');s.textContent='#zqLegalFooter{margin-top:60px;padding:30px 5%;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;background:#111114;color:#fff;border-top:1px solid #303035}#zqLegalFooter strong{display:block;font-size:18px}#zqLegalFooter span,#zqLegalFooter small{color:#aaa;font-size:12px}#zqLegalFooter nav{display:flex;gap:8px;flex-wrap:wrap}#zqLegalFooter nav button{border:0;background:transparent;color:#ddd;cursor:pointer;padding:7px 9px}#zqLegalFooter nav button:hover{color:#9cff00}#zqLegalModal .modal-card{max-width:760px}#zqLegalModal h3{margin-top:24px}#zqLegalModal p{line-height:1.65}#zqLegalModal a{color:#6f42c1}';
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();