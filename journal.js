/* Top'Math — journal de classe local, par date et période. */
(function(){
'use strict';
const KEY='topmath-journal-v1';
let store={entries:{},fontSize:18};
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved==='object')store={entries:saved.entries&&typeof saved.entries==='object'?saved.entries:{},fontSize:Number(saved.fontSize)||18};}catch{}
let activeKey='',lastHtml='';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nowDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const periodFor=(slot,c)=>slot?.classe===c&&slot?.period?String(slot.period):'';
const saved=()=>{try{localStorage.setItem(KEY,JSON.stringify(store));return true;}catch{alert('Impossible de sauvegarder sur cet appareil. Téléchargez votre journal.');return false;}};
function dl(file,txt,mime){const u=URL.createObjectURL(new Blob([txt],{type:mime})),a=document.createElement('a');a.href=u;a.download=file;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);}
function journalKey(date,p,c){return JSON.stringify([date,String(p||''),c]);}
function refresh(c,slot,date,period){
 const key=journalKey(date,period,c);activeKey=key;
 const entry=store.entries[key]||{text:''};
 $('journalEditor').value=entry.text||'';
 lastHtml=entry.text||'';
 $('journalSaveState').textContent=entry.updated?'Dernière sauvegarde : '+new Date(entry.updated).toLocaleString('fr-BE'):'Aucun contenu enregistré pour ce cours';
 $('journalSize').textContent=store.fontSize+' px';
 $('journalEditor').style.fontSize=store.fontSize+'px';
}
function persistPrevious(c){
 const text=$('journalEditor').value;
 const old=store.entries[activeKey]||{};
 let coordinates;try{coordinates=JSON.parse(activeKey);}catch{return;}
 const [date,period,classe]=coordinates;
 store.entries[activeKey]={...old,date,period,classe,text,updated:new Date().toISOString()};
 saved();
}
function persist(c){
 const date=$('journalDate').value,period=$('journalPeriod').value;
 if(!date){alert('Sélectionnez une date.');return;}
 const key=journalKey(date,period,c),text=$('journalEditor').value;
 if(!text.trim()&&!store.entries[key]){$('journalSaveState').textContent='Aucun texte à enregistrer';return;}
 store.entries[key]={date,period,classe:c,text,updated:new Date().toISOString()};
 if(saved()){$('journalSaveState').textContent='Enregistré le '+new Date(store.entries[key].updated).toLocaleString('fr-BE');lastHtml=text;}
}
function render(c,slot){
 const date=nowDate(),cur=periodFor(slot,c),available=(window.topmathSchedule?.()||[]).filter(x=>x.classe===c).map(x=>String(x.period||'')).filter(Boolean);
 let periods=[...new Set([...available,'1','2','3','4','5','6','7','8','9'])].sort((a,b)=>Number(a)-Number(b));
 const oldDate=$('journalDate')?.value||date,oldPeriod=$('journalPeriod')?.value||cur||periods[0];
 const chosenPeriod=(slot&&slot.classe===c&&cur)?cur:oldPeriod;
 $('view').innerHTML='<div class="journal-course-frame"><div class="journal-frame-top"><div class="journal-course-name"><span class="attendance-course-eyebrow">JOURNAL DE CLASSE</span><h2>'+esc(c)+'</h2><p class="journal-course-time">'+esc(slot&&slot.classe===c&&slot.start?slot.start+' – '+slot.end:'Cours sélectionné')+'</p></div></div>'+
 '<div class="journal-settings-body" id="journalSettingsBody" hidden>'+
 '<div class="journal-setting-group"><div class="journal-setting-title">Cours</div><div class="row"><div><label for="journalDate">Date</label><input type="date" id="journalDate" value="'+esc(oldDate)+'"></div><div><label for="journalPeriod">Heure de cours</label><select id="journalPeriod">'+periods.map(p=>'<option value="'+esc(p)+'"'+(chosenPeriod===p?' selected':'')+'>Période '+esc(p)+'</option>').join('')+'</select></div></div></div>'+
 '<div class="journal-setting-group"><div class="journal-setting-title">Écriture</div><div class="journal-size-row"><span>Taille du texte</span><div class="journal-toolbar"><button type="button" id="journalSmaller" aria-label="Réduire le texte">A−</button><strong id="journalSize"></strong><button type="button" id="journalBigger" aria-label="Agrandir le texte">A+</button></div></div></div>'+
 '<div class="journal-setting-group"><div class="journal-setting-title">Téléchargements</div><div class="journal-downloads"><button type="button" id="journalPrint">PDF / Imprimer</button><button type="button" id="journalExport">Texte</button><button type="button" id="journalBackup">Sauvegarde complète</button></div></div>'+
 '<p class="journal-settings-hint">Sauvegarde automatique sur cet iPad. Pense à conserver une copie : ce journal n’est pas synchronisé avec le journal officiel.</p></div></div>'+
 '<label for="journalEditor" class="journal-writing-label">Notes du cours</label><textarea id="journalEditor" class="journal-editor" rows="17" placeholder="Écrire ici ce que nous avons fait aujourd’hui…"></textarea>'+
 '<p class="muted small" id="journalSaveState" role="status"></p>';
 const update=()=>refresh(c,slot,$('journalDate').value,$('journalPeriod').value);
 $('journalDate').addEventListener('change',()=>{if($('journalEditor').value!==lastHtml)persistPrevious(c);update();});
 $('journalPeriod').addEventListener('change',()=>{if($('journalEditor').value!==lastHtml)persistPrevious(c);update();});

 $('journalBigger').addEventListener('click',()=>{store.fontSize=Math.min(32,store.fontSize+2);saved();$('journalEditor').style.fontSize=store.fontSize+'px';$('journalSize').textContent=store.fontSize+' px';});
 $('journalSmaller').addEventListener('click',()=>{store.fontSize=Math.max(14,store.fontSize-2);saved();$('journalEditor').style.fontSize=store.fontSize+'px';$('journalSize').textContent=store.fontSize+' px';});
 let autoSaveTimer;
 $('journalEditor').addEventListener('input',()=>{$('journalSaveState').textContent='Enregistrement…';clearTimeout(autoSaveTimer);autoSaveTimer=setTimeout(()=>persist(c),700);});
 $('journalEditor').addEventListener('blur',()=>{clearTimeout(autoSaveTimer);if($('journalEditor').value!==lastHtml)persist(c);});
 $('journalExport').addEventListener('click',()=>{persist(c);dl('topmath-journal-'+$('journalDate').value+'-'+c.replace(/[^a-z0-9-]/gi,'-')+'.txt',c+' · '+$('journalDate').value+' · Période '+$('journalPeriod').value+'\n\n'+$('journalEditor').value,'text/plain;charset=utf-8');});
 $('journalBackup').addEventListener('click',()=>dl('topmath-journaux-sauvegarde-'+nowDate()+'.json',JSON.stringify({format:KEY,exported:new Date().toISOString(),...store},null,2),'application/json;charset=utf-8'));
 $('journalPrint').addEventListener('click',()=>{persist(c);const w=window.open('','_blank');if(!w){alert('Autorisez les fenêtres pour imprimer.');return;}const h='<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Journal de classe</title><style>body{font:17px Arial,sans-serif;margin:30mm 20mm;color:#222}h1{font-size:24px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>Journal de classe — '+esc(c)+'</h1><p>'+esc($('journalDate').value)+' · Période '+esc($('journalPeriod').value)+'</p><hr><pre>'+esc($('journalEditor').value)+'</pre></body></html>';w.document.write(h);w.document.close();w.focus();setTimeout(()=>w.print(),250);});
 refresh(c,slot,oldDate,chosenPeriod);
}
function toggleSettings(){
 const body=$('journalSettingsBody'),button=$('topSettingsBtn');
 if(!body){return false;}
 const opening=body.hidden;
 body.hidden=!opening;
 if(button){
  button.setAttribute('aria-expanded',String(opening));
  button.setAttribute('aria-label',opening?'Fermer les réglages du journal':'Ouvrir les réglages du journal');
  button.title=opening?'Fermer les réglages':'Ouvrir les réglages';
 }
 return true;
}
window.TopMathJournal={render,toggleSettings};
})();