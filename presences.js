/* Top'Math — relevé de présences local (prototype, données non synchronisées) */
(function(){
'use strict';
const KEY='topmath-presences-v1';
let state;
try{state=JSON.parse(localStorage.getItem(KEY))||{};}catch{state={};}
if(!state.rosters||typeof state.rosters!=='object')state.rosters={};
if(!state.sessions||typeof state.sessions!=='object')state.sessions={};
let selectedDate='',selectedPeriod='',selectedStudent='',selectedClass='',lastSlotKey='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=s=>document.getElementById(s);
const today=()=>{const d=new Date(),n=d.getTimezoneOffset()*60000;return new Date(d-n).toISOString().slice(0,10);};
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){alert("Enregistrement impossible : espace de stockage indisponible. Exportez vos données.");return false;}};
const sessionKey=(date,periode,classe)=>JSON.stringify([date,String(periode),classe]);
const validStatus=['','P','A','R'];
function roster(c){return Array.isArray(state.rosters[c])?state.rosters[c]:[];}
function session(date,period,c){return state.sessions[sessionKey(date,period,c)];}
function getSlots(c){return (window.topmathSchedule?.()||[]).filter(x=>x.classe===c);}
function periodOptions(c){let periods=[...new Set(getSlots(c).map(x=>String(x.period||'')).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));if(!periods.length)periods=['1','2','3','4','5','6','7','8','9'];return periods;}
function download(name,content,type){let blob=new Blob(['\uFEFF',content],{type}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);}
function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"';}
function csv(rows){return rows.map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n';}
function records(){return Object.values(state.sessions).filter(s=>s&&Array.isArray(s.entries)).flatMap(s=>s.entries.map(e=>({date:s.date,periode:s.period,classe:s.classe,name:e.name,status:e.status||'',updated:s.updated||''})));}
function rosterNames(text){
 let lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const result=[];
 for(let x of lines){
   let cols=x.includes(';')?x.split(';'):x.includes('\t')?x.split('\t'):[x];
   let name=cols.length>1?cols.filter(y=>y.trim()).slice(0,2).join(' ').trim():cols[0].trim();
   if(/^(nom|prénom|prenom|élève|eleve|name)(\s|;|$)/i.test(name))continue;
   if(name.length>2&&name.length<=120&&!result.some(y=>y.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr')))result.push(name);
 }
 return result.sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
}
function render(c,slot){
 if(selectedClass!==c){selectedPeriod='';selectedStudent='';}
 selectedClass=c;
 if(!selectedDate)selectedDate=today();
 const cur=slot&&slot.classe===c&&slot.period?String(slot.period):'';
 const slotKey=slot?.id||'';
 if(slotKey!==lastSlotKey){if(cur)selectedPeriod=cur;lastSlotKey=slotKey;}
 const periods=periodOptions(c);
 if(!selectedPeriod||!periods.includes(selectedPeriod))selectedPeriod=cur||periods[0];
 const students=roster(c),ss=session(selectedDate,selectedPeriod,c);
 let map=new Map((ss?.entries||[]).map(x=>[x.name,x.status]));
 let nDone=students.filter(x=>validStatus.slice(1).includes(map.get(x))).length;
 const html='<h2>Présences · '+esc(c)+'</h2>'+
 '<p class="muted small">Feuille de présence indépendante, avec conservation locale sur cet iPad. Les anciennes séances sont consultables et exportables.</p>'+
 '<div class="notice small"><strong>Confidentialité :</strong> prototype sans compte individuel ni synchronisation sécurisée. Ne l’utilisez pas pour le registre officiel ou avec des données personnelles réelles sans validation de l’établissement. Une suppression des données Safari efface l’historique local.</div>'+
 '<div class="row"><div><label for="attDate">Date du cours</label><input type="date" id="attDate" value="'+esc(selectedDate)+'"></div>'+
 '<div><label for="attPeriod">Période</label><select id="attPeriod">'+periods.map(p=>'<option value="'+esc(p)+'"'+(selectedPeriod===p?' selected':'')+'>Période '+esc(p)+'</option>').join('')+'</select></div></div>'+
 (ss?'<p class="pill">Enregistré le '+esc(new Date(ss.updated).toLocaleString('fr-BE'))+'</p>':'<p class="muted small">Aucun appel enregistré pour cette séance.</p>')+
 '<div class="flex" style="margin:16px 0 8px"><strong>'+students.length+' élèves · '+nDone+' réponses renseignées</strong><span class="pill">'+(students.length-nDone)+' à renseigner</span></div>'+
 (students.length?students.map((name,i)=>'<div class="task flex"><div><strong>'+esc(name)+'</strong></div><div><label for="attStatus'+i+'" class="small">Statut</label><select id="attStatus'+i+'" data-att-student="'+esc(name)+'">'+[['','Non renseigné'],['P','Présent'],['A','Absent'],['R','Retard']].map(([v,l])=>'<option value="'+v+'"'+((map.get(name)||'')===v?' selected':'')+'>'+l+'</option>').join('')+'</select></div></div>').join(''):'<p class="notice">Aucune liste d’élèves importée pour cette classe. Ajoutez-la ci-dessous avant de faire l’appel.</p>')+
 '<div class="actions"><button type="button" class="btn-primary" id="attSave"'+(!students.length?' disabled':'')+'>Enregistrer la présence</button><button type="button" id="attAll"'+(!students.length?' disabled':'')+'>Tous présents</button><button type="button" id="attClear">Effacer les choix affichés</button></div>'+
 '<hr><details><summary>📥 Importer ou modifier la liste des élèves</summary>'+
 '<p class="muted small">Collez un élève par ligne, ou importez un fichier TXT ou CSV (colonnes « Nom;Prénom »). Cette liste concerne uniquement la classe '+esc(c)+'.</p>'+
 '<label for="attList">Liste d’élèves (un par ligne)</label><textarea id="attList" rows="6" placeholder="Nom Prénom&#10;Nom Prénom">'+esc(students.join('\n'))+'</textarea>'+
 '<label for="attFile">Importer un fichier .txt ou .csv</label><input type="file" id="attFile" accept=".csv,.txt,text/plain,text/csv">'+
 '<div class="actions"><button type="button" id="attImport">Enregistrer la liste de la classe</button></div>'+
 '<p class="muted small">Remplacer une liste ne supprime pas les anciennes feuilles de présence sauvegardées.</p></details>'+
 '<hr><h2>Historique et justificatifs</h2>'+
 '<div class="row"><div><label for="attStudent">Élève</label><select id="attStudent"><option value="">Tous les élèves</option>'+[...new Set([...students,...records().filter(x=>x.classe===c).map(x=>x.name)])].sort((a,b)=>a.localeCompare(b,'fr')).map(x=>'<option value="'+esc(x)+'"'+(selectedStudent===x?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div>'+
 '<div><label for="attClasseFilter">Classe exportée</label><select id="attClasseFilter"><option value="current">Cette classe</option><option value="all">Toutes les classes</option></select></div></div>'+
 '<div class="actions"><button id="attCsv" type="button">Télécharger l’historique CSV</button><button id="attJson" type="button">Sauvegarder toutes les présences (JSON)</button><button id="attRestore" type="button">Restaurer une sauvegarde</button><input type="file" accept=".json,application/json" id="attRestoreFile" style="display:none"></div>'+
 '<div id="attHistory"></div>';
 id('view').innerHTML=html;history(c);
 id('attDate').addEventListener('change',e=>{selectedDate=e.target.value||today();render(c,slot);});
 id('attPeriod').addEventListener('change',e=>{selectedPeriod=e.target.value;render(c,slot);});
 id('attStudent').addEventListener('change',e=>{selectedStudent=e.target.value;history(c);});
 id('attSave').addEventListener('click',()=>saveCall(c));
 id('attAll').addEventListener('click',()=>document.querySelectorAll('[data-att-student]').forEach(x=>x.value='P'));
 id('attClear').addEventListener('click',()=>document.querySelectorAll('[data-att-student]').forEach(x=>x.value=''));
 id('attImport').addEventListener('click',()=>{const names=rosterNames(id('attList').value);if(!names.length){alert('Aucun nom valide détecté.');return;}if(!confirm('Enregistrer '+names.length+' élèves pour '+c+' ?'))return;state.rosters[c]=names;if(persist()){selectedStudent='';render(c,slot);}});
 id('attFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>500000){alert('Fichier trop volumineux.');return;}const raw=await f.text();id('attList').value=rosterNames(raw).join('\n');});
 id('attCsv').addEventListener('click',()=>exportCSV(c));
 id('attJson').addEventListener('click',()=>download('topmath-presences-sauvegarde-'+today()+'.json',JSON.stringify({format:'topmath-presences-v1',exported:new Date().toISOString(),rosters:state.rosters,sessions:state.sessions},null,2),'application/json;charset=utf-8'));
 id('attRestore').addEventListener('click',()=>id('attRestoreFile').click());
 id('attRestoreFile').addEventListener('change',async e=>{let f=e.target.files?.[0];if(!f)return;try{const obj=JSON.parse(await f.text());if(obj.format!=='topmath-presences-v1'||!obj.rosters||!obj.sessions||Array.isArray(obj.sessions))throw Error('Format invalide');if(!confirm('Remplacer les listes et les présences locales par la sauvegarde sélectionnée ?'))return;state={rosters:obj.rosters,sessions:obj.sessions};if(persist()){selectedStudent='';render(c,slot);}}catch(err){alert('Sauvegarde invalide : '+err.message);}});
}
function saveCall(c){
 const names=roster(c);
 const entries=names.map(name=>({name,status:document.querySelectorAll('[data-att-student]')?([...document.querySelectorAll('[data-att-student]')].find(x=>x.dataset.attStudent===name)?.value||''):''}));
 if(!entries.every(x=>validStatus.includes(x.status))){alert('Statut non valide.');return;}
 const blank=entries.filter(x=>!x.status).length;
 if(blank&&!confirm(blank+' élève(s) sans statut. Enregistrer quand même l’appel incomplet ?'))return;
 const key=sessionKey(selectedDate,selectedPeriod,c);
 state.sessions[key]={date:selectedDate,period:selectedPeriod,classe:c,entries,updated:new Date().toISOString()};
 if(persist()){render(c,window.topmathCurrentSlot?.());alert('Appel enregistré sur cet iPad. Pensez à sauvegarder régulièrement vos données.');}
}
function history(c){
 const rows=records().filter(x=>x.classe===c&&(!selectedStudent||x.name===selectedStudent)).sort((a,b)=>b.date.localeCompare(a.date)||Number(b.periode)-Number(a.periode));
 const sessions=[...new Set(rows.map(x=>x.date+'|'+x.periode))];
 id('attHistory').innerHTML='<p class="muted small">'+sessions.length+' séance(s) trouvée(s) · '+rows.length+' ligne(s) de présence.</p>'+
 '<div style="max-height:290px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:.9rem"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ccc">Date / Période</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ccc">Élève</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ccc">Statut</th></tr></thead><tbody>'+rows.slice(0,150).map(r=>'<tr><td style="padding:7px;border-bottom:1px solid #eee">'+esc(r.date)+' · P'+esc(r.periode)+'</td><td style="padding:7px;border-bottom:1px solid #eee">'+esc(r.name)+'</td><td style="padding:7px;border-bottom:1px solid #eee">'+esc(({P:'Présent',A:'Absent',R:'Retard'})[r.status]||'Non renseigné')+'</td></tr>').join('')+'</tbody></table></div>'+
 (rows.length>150?'<p class="small muted">Aperçu limité à 150 lignes : l’export contient tout l’historique.</p>':'');
}
function exportCSV(c){
 const scope=id('attClasseFilter').value;
 const rows=records().filter(x=>(scope==='all'||x.classe===c)&&(!selectedStudent||x.name===selectedStudent)).sort((a,b)=>a.date.localeCompare(b.date)||Number(a.periode)-Number(b.periode)||a.name.localeCompare(b.name,'fr'));
 if(!rows.length){alert('Aucune présence enregistrée pour ce filtre.');return;}
 const data=[['Date','Période','Classe','Élève','Statut','Dernière modification'],...rows.map(r=>[r.date,r.periode,r.classe,r.name,({P:'Présent',A:'Absent',R:'Retard'})[r.status]||'Non renseigné',r.updated])];
 download('topmath-presences-'+(scope==='all'?'toutes-classes':c.replace(/[^a-z0-9-]/gi,'-'))+'-'+today()+'.csv',csv(data),'text/csv;charset=utf-8');
}
window.TopMathAttendance={render};
})();