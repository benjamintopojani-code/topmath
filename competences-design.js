/* Top'Math | Gestion des compétences — prototype local de conception */
(()=>{
'use strict';
const KEY='topmath-competences-design-v1';
const base={classes:['P1 Construction A','Observation B','P2 horticulture','P3 maçonnerie'],students:[],evaluations:[]};
let db;try{db=JSON.parse(localStorage.getItem(KEY))||base}catch{db=structuredClone(base)}
for(const k of ['classes','students','evaluations'])if(!Array.isArray(db[k]))db[k]=[];
let selectedClass=db.classes[0]||'',selectedStudent='',message='';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const options=(arr,chosen)=>arr.map(x=>'<option value="'+esc(x)+'"'+(x===chosen?' selected':'')+'>'+esc(x)+'</option>').join('');
const evaluationStatus=e=>e.open?'Ouverte':'Fermée';
const formClass=()=>'<label>Classe<select id="cls">'+options(db.classes,selectedClass)+'</select></label>';
const alertBox=()=>'<div class="notice"><strong>Mode de test local.</strong> Les changements sont sauvegardés uniquement dans ce navigateur. Ils ne modifient pas les comptes élèves, ni leurs évaluations réelles.</div>';
const toolBar=()=>'<div class="toolbar">'+formClass()+'<a class="smallbtn" href="competences-enseignant.html">← Menu Compétences</a></div>';
const entries=()=>db.evaluations.filter(e=>e.className===selectedClass).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
const students=()=>db.students.filter(s=>s.className===selectedClass);
const notify=txt=>{message=txt;render()};
const page=document.body.dataset.page;
function render(){
const root=$('app');if(!root)return;
if(!selectedClass||!db.classes.includes(selectedClass))selectedClass=db.classes[0]||'';
let html=alertBox()+toolBar()+(message?'<div class="feedback" role="status">'+esc(message)+'</div>':'');
if(page==='evaluations'){
const items=entries();
html+='<section class="panel"><h2>Évaluations par classe</h2><p class="minor">'+esc(selectedClass)+' · '+items.length+' évaluation(s) enregistrée(s)</p><div class="list">'+(items.length?items.map(e=>'<div class="entry"><div><strong>'+esc(e.code)+' · '+esc(e.title)+'</strong><p>'+esc(e.date||'Date non fixée')+' · <span class="'+(e.open?'open':'closed')+'">'+evaluationStatus(e)+'</span></p></div><a class="smallbtn" href="ouverture-competences.html">Gérer l’accès</a></div>').join(''):'<p>Aucune évaluation enregistrée pour cette classe.</p>')+'</div></section>';
html+='<section class="panel"><h2>Créer une évaluation</h2><form id="newEval" class="fields"><label>Code compétence<input name="code" required placeholder="Ex. N104"></label><label>Intitulé<input name="title" required placeholder="Addition posée"></label><label>Date prévue<input name="date" type="date"></label><button type="submit">Ajouter l’évaluation (fermée)</button></form></section>';
}
if(page==='eleves'){
const ss=students(); if(!selectedStudent||!ss.some(s=>s.id===selectedStudent))selectedStudent=ss[0]?.id||'';
const s=ss.find(x=>x.id===selectedStudent);
html+='<section class="panel"><h2>Tableau de compétences par élève</h2><div class="toolbar"><label>Élève<select id="studentPick">'+options(ss.map(x=>x.id),selectedStudent).replace(/>([^<]+)<\/option>/g,(str,id)=>{const x=ss.find(s=>s.id===id);return '>'+esc(x?.name||id)+'</option>'})+'</select></label></div>';
html+=s?'<p>Suivi de <strong>'+esc(s.name)+'</strong>. Les changements de résultats sont manuels.</p><div class="list">'+(entries().length?entries().map(e=>{const result=s.results?.[e.id]||'Non évalué';return '<div class="entry"><div><strong>'+esc(e.code)+' · '+esc(e.title)+'</strong><p>Résultat actuel : '+esc(result)+'</p></div><label>Modifier<select class="result" data-eid="'+esc(e.id)+'"><option>'+options(['Non évalué','Acquis','En cours','Non acquis','Absent'],result)+'</select></label></div>'}).join(''):'<p>Aucune compétence enregistrée pour cette classe.</p>')+'</div>':'<p>Aucun élève ajouté dans cette classe.</p>';
html+='</section><section class="panel"><h2>Ajouter un élève au tableau de test</h2><form id="newStudent" class="fields"><label>Nom affiché<input name="name" required placeholder="Nom de l’élève"></label><button type="submit">Ajouter</button></form></section>';
}
if(page==='ouverture'){
html+='<section class="panel"><h2>Ouverture et fermeture des compétences</h2><p>Par défaut, toute nouvelle évaluation est fermée. L’ouverture enregistrée ici sert uniquement à tester l’interface enseignant.</p><div class="list">'+(entries().length?entries().map(e=>'<div class="entry"><div><strong>'+esc(e.code)+' · '+esc(e.title)+'</strong><p>'+esc(e.date||'Sans date')+' · <span class="'+(e.open?'open':'closed')+'">'+evaluationStatus(e)+'</span></p></div><button class="toggle" data-eid="'+esc(e.id)+'">'+(e.open?'Fermer':'Ouvrir')+'</button></div>').join(''):'<p>Aucune évaluation à gérer dans cette classe. Créez-en dans « Évaluations par classe ».</p>')+'</div></section>';
html+='<p class="notice">Important : l’interdiction de démarrer une évaluation doit aussi être contrôlée dans l’espace élève et côté serveur. Le bouton ci-dessus ne l’active pas encore.</p>';
}
root.innerHTML=html;
$('cls')?.addEventListener('change',e=>{selectedClass=e.target.value;selectedStudent='';message='';render()});
$('studentPick')?.addEventListener('change',e=>{selectedStudent=e.target.value;message='';render()});
$('newEval')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);db.evaluations.push({id:crypto.randomUUID(),className:selectedClass,code:String(f.get('code')).trim().toUpperCase(),title:String(f.get('title')).trim(),date:String(f.get('date')||''),open:false});save();notify('Évaluation ajoutée en mode test, avec accès fermé.')});
$('newStudent')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),name=String(f.get('name')).trim();if(!name)return;const s={id:crypto.randomUUID(),name,className:selectedClass,results:{}};db.students.push(s);selectedStudent=s.id;save();notify('Élève ajouté au tableau de test.')});
root.querySelectorAll('.result').forEach(el=>el.addEventListener('change',e=>{const s=db.students.find(s=>s.id===selectedStudent);if(!s)return;s.results??={};s.results[e.target.dataset.eid]=e.target.value;save();notify('Résultat modifié localement.')}));
root.querySelectorAll('.toggle').forEach(el=>el.addEventListener('click',e=>{const v=db.evaluations.find(x=>x.id===e.currentTarget.dataset.eid);if(!v)return;v.open=!v.open;save();notify('État de test : '+evaluationStatus(v).toLowerCase()+'.')}));
}
render();
})();