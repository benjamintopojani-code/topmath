/* Top'Math / Mes classes - interface de prévisualisation à données locales */
(()=>{'use strict';
const KEY='topmath-competences-design-v1';
let data;try{data=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{data={}}
data.classes=Array.isArray(data.classes)?data.classes:['P1 Construction A','Observation B','P2 horticulture','P3 maçonnerie'];
data.students=Array.isArray(data.students)?data.students:[];
data.evaluations=Array.isArray(data.evaluations)?data.evaluations:[];
data.notes=data.notes||{};data.attendance=data.attendance||{};data.training=data.training||{};
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id),save=()=>localStorage.setItem(KEY,JSON.stringify(data)),today=()=>new Date().toISOString().slice(0,10);
let cls='',student='',tab='competences',msg='';
const classStudents=c=>data.students.filter(s=>s.className===c).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
const classEvals=c=>data.evaluations.filter(e=>e.className===c);
// Une compétence est certifiée uniquement lorsque les 3 évaluations sont datées.
const datesOf=(student,id)=>{const d=student.validationDates?.[id];return Array.from({length:3},(_,i)=>typeof d?.[i]==='string'?d[i]:'')};
const countValid=(student,id)=>datesOf(student,id).filter(Boolean).length;
const counts=s=>{const ev=classEvals(s.className),n=ev.map(e=>countValid(s,e.id));return {cert:n.filter(x=>x===3).length,ongoing:n.filter(x=>x>0&&x<3).length,total:ev.length}};
const nextDate=s=>classEvals(s.className).filter(e=>e.date&&e.date>=today()&&countValid(s,e.id)<3).sort((a,b)=>a.date.localeCompare(b.date))[0]?.date||'À planifier';
const studentUrl=s=>'fiche-eleve.html?id='+encodeURIComponent(s.id);
function notice(){return '<div class="notice"><strong>Prototype local :</strong> les élèves, résultats, présences et observations saisis ici restent sur ce navigateur. Aucune synchronisation avec les vrais dossiers.</div>'}
function trail(items){return '<div class="trail">'+items.join('<span>›</span>')+'</div>'}
function classes(){
let blocks=data.classes.map(c=>{let ss=classStudents(c),ev=classEvals(c);return '<a class="classcard" href="classe-details.html?classe='+encodeURIComponent(c)+'"><span class="classicon">▦</span><strong>'+E(c)+'</strong><small>'+ss.length+' élève(s) dans le prototype · '+ev.length+' compétence(s)</small><span class="arrow">→</span></a>'}).join('');
return notice()+trail(['Mes classes'])+'<h1>Mes classes</h1><p class="intro">Choisis une classe pour consulter ses élèves et leur progression.</p><div class="classgrid">'+blocks+'</div><section class="panel"><h2>Ajouter une classe de test</h2><form id="addClass" class="formline"><label>Nom de la classe<input required name="name" placeholder="Ex. P2 TB"></label><button>Ajouter</button></form></section>'
}
function classe(){
const ss=classStudents(cls);
let rows=ss.map(s=>{let n=counts(s);return '<a class="studentrow" href="'+studentUrl(s)+'"><span class="avatar">'+E(s.name.charAt(0).toUpperCase())+'</span><span class="studentname"><strong>'+E(s.name)+'</strong><small>Ouvrir le dossier de l’élève</small></span><span class="stat cert">'+n.cert+' certifiée(s)</span><span class="stat current">'+n.ongoing+' en cours</span><span class="date">Prochaine : '+E(nextDate(s))+'</span><span class="arrow">→</span></a>'}).join('');
return notice()+trail(['<a href="mes-classes.html">Mes classes</a>',E(cls)])+'<h1>'+E(cls)+'</h1><p class="intro">Vue globale des élèves, compétences certifiées et prochaines évaluations.</p><section class="metrics"><div><strong>'+ss.length+'</strong><small>Élèves</small></div><div><strong>'+classEvals(cls).length+'</strong><small>Compétences</small></div><div><strong>'+ss.reduce((n,s)=>n+counts(s).cert,0)+'</strong><small>Certifications</small></div></section><section class="panel"><h2>Liste des élèves</h2><div class="studentlist">'+(rows||'<p>Aucun élève enregistré dans cette classe de test.</p>')+'</div></section><section class="panel"><h2>Ajouter un élève de test</h2><form id="addStudent" class="formline"><label>Nom et prénom<input required name="name" placeholder="Nom de l’élève"></label><button>Ajouter</button></form></section>'
}
function dashboard(s){const c=counts(s),all=classEvals(s.className),pct=all.length?Math.round(c.cert/all.length*100):0;return '<section class="metrics"><div><strong>'+c.cert+'</strong><small>Certifiées</small></div><div><strong>'+c.ongoing+'</strong><small>En cours</small></div><div><strong>'+E(nextDate(s))+'</strong><small>Prochaine évaluation</small></div></section><div class="progress-head"><strong>Progression des certifications</strong><span>'+pct+' %</span></div><div class="progressbar" role="progressbar" aria-label="Compétences certifiées" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100"><span style="width:'+pct+'%"></span></div><p class="minor">Basée sur '+all.length+' compétence(s) actuellement enregistrée(s) dans le prototype.</p>'}
function fiches(){
const s=data.students.find(x=>x.id===student);
if(!s)return notice()+'<h1>Élève introuvable</h1><a class="backlink" href="mes-classes.html">Retour aux classes</a>';
const tabs=[['competences','Compétences'],['presences','Présences'],['comportement','Comportement'],['progres','Progrès / exercices']];
let h=notice()+trail(['<a href="mes-classes.html">Mes classes</a>','<a href="classe-details.html?classe='+encodeURIComponent(s.className)+'">'+E(s.className)+'</a>',E(s.name)])+'<div class="person"><span class="avatar big">'+E(s.name[0])+'</span><div><div class="kicker">FICHE ÉLÈVE</div><h1>'+E(s.name)+'</h1><p>'+E(s.className)+'</p></div></div>'+dashboard(s)+'<nav class="tabs" aria-label="Dossier élève">'+tabs.map(([id,label])=>'<button type="button" data-tab="'+id+'" class="'+(tab===id?'active':'')+'">'+label+'</button>').join('')+'</nav><section class="panel">';
if(tab==='competences'){
const entries=classEvals(s.className);
h+='<h2>Tableau des compétences</h2><p class="minor">Une évaluation est validée lorsqu’une date est renseignée. Effacer cette date annule la validation. La compétence est acquise uniquement après 3 évaluations validées.</p><div class="competency-table-wrap"><table class="competency-table"><thead><tr><th scope="col">Compétence</th><th scope="col">Évaluation 1</th><th scope="col">Évaluation 2</th><th scope="col">Évaluation 3</th><th scope="col">Bilan</th></tr></thead><tbody>'+
(entries.length?entries.map(e=>{const dates=datesOf(s,e.id),n=dates.filter(Boolean).length;return '<tr><th scope="row"><strong>'+E(e.code)+'</strong><small>'+E(e.title)+'</small></th>'+dates.map((d,i)=>'<td><label class="date-control"><span class="date-state '+(d?'validated':'pending')+'">'+(d?'✓ Validée':'À valider')+'</span><input type="date" aria-label="'+E(e.code)+' évaluation '+(i+1)+'" data-evaluation-date="'+E(e.id)+'" data-slot="'+i+'" value="'+E(d)+'"></label></td>').join('')+'<td><span class="certification '+(n===3?'certified':n?'progress':'notstarted')+'">'+(n===3?'Acquise':n+'/3 validées')+'</span></td></tr>'}).join(''):'<tr><td colspan="5">Aucune compétence enregistrée. Ajoutez-en depuis « Évaluations par classe ».</td></tr>')+'</tbody></table></div><a class="backlink" href="evaluations-a-venir.html">Gérer les évaluations →</a>';
}
if(tab==='presences'){
const rec=data.attendance[s.id]||[];
const tally={P:0,A:0,S:0};rec.forEach(x=>{if(x.status in tally)tally[x.status]++});
h+='<h2>Récapitulatif des présences</h2><div class="minimetrics"><span>Présent : <b>'+tally.P+'</b></span><span>Absent : <b>'+tally.A+'</b></span><span>Stage : <b>'+tally.S+'</b></span></div><form id="addAttendance" class="formline"><label>Date<input name="date" type="date" value="'+today()+'" required></label><label>Statut<select name="status"><option value="P">Présent</option><option value="A">Absent</option><option value="S">Stage</option></select></label><button>Enregistrer</button></form><div class="list">'+(rec.length?rec.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>'<div class="entry"><strong>'+E(x.date)+'</strong><span>'+({P:'Présent',A:'Absent',S:'Stage'}[x.status]||'—')+'</span></div>').join(''):'<p>Aucune présence saisie dans cette maquette.</p>')+'</div><p class="minor">Ces saisies de démonstration ne sont pas reliées au registre de présences réel.</p>';
}
if(tab==='comportement'){
const rec=data.notes[s.id]||[];
h+='<h2>Suivi du comportement</h2><form id="addBehavior" class="formline"><label>Date<input name="date" type="date" value="'+today()+'" required></label><label>Appréciation<select name="rating"><option>TB</option><option>B</option><option>S</option><option>I</option></select></label><label class="wide">Observation<textarea name="note" placeholder="Observation factuelle…" required maxlength="1200"></textarea></label><button>Ajouter l’observation</button></form><div class="list">'+(rec.length?rec.slice().reverse().map(x=>'<div class="entry"><div><strong>'+E(x.date)+' · '+E(x.rating)+'</strong><p>'+E(x.note)+'</p></div></div>').join(''):'<p>Aucune observation enregistrée.</p>')+'</div>';
}
if(tab==='progres'){
const rec=data.training[s.id]||[];
h+='<h2>Progrès dans les exercices</h2><p class="minor">Les résultats automatiques des applications élèves seront à connecter ultérieurement.</p><form id="addExercise" class="formline"><label>Exercice<input name="exercise" required placeholder="N104 – Exercice 1"></label><label>Score sur 10<input type="number" name="score" min="0" max="10" step="0.5" required></label><label>Date<input type="date" name="date" value="'+today()+'" required></label><button>Ajouter un résultat</button></form><div class="list">'+(rec.length?rec.slice().reverse().map(x=>'<div class="entry"><div><strong>'+E(x.exercise)+'</strong><p>'+E(x.date)+'</p></div><strong>'+E(x.score)+'/10</strong></div>').join(''):'<p>Aucun exercice de test enregistré.</p>')+'</div>';
}
return h+'</section>';
}
function render(){const root=$('app');if(!root)return;root.innerHTML=(location.pathname.endsWith('classe-details.html')?classe():location.pathname.endsWith('fiche-eleve.html')?fiches():classes())+(msg?'<div class="toast" role="status">'+E(msg)+'</div>':'');wire()}
function wire(){
$('addClass')?.addEventListener('submit',e=>{e.preventDefault();const name=e.target.elements.name.value.trim();if(!name||data.classes.includes(name))return;data.classes.push(name);save();msg='Classe ajoutée dans le prototype.';render()});
$('addStudent')?.addEventListener('submit',e=>{e.preventDefault();const name=e.target.elements.name.value.trim();if(!name)return;data.students.push({id:crypto.randomUUID(),name,className:cls,results:{}});save();msg='Élève de test ajouté.';render()});
document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>{tab=el.dataset.tab;msg='';render()}));
document.querySelectorAll('[data-evaluation-date]').forEach(el=>el.addEventListener('change',()=>{
const studentRecord=data.students.find(x=>x.id===student);if(!studentRecord)return;
studentRecord.validationDates??={};
const id=el.dataset.evaluationDate,slot=Number(el.dataset.slot);
if(!Number.isInteger(slot)||slot<0||slot>2)return;
const dates=datesOf(studentRecord,id);dates[slot]=el.value;
if(dates.every(d=>!d))delete studentRecord.validationDates[id];else studentRecord.validationDates[id]=dates;
save();msg=dates.filter(Boolean).length===3?'Compétence acquise : les 3 évaluations sont datées.':el.value?'Évaluation validée par sa date.':'Date effacée : évaluation non validée.';render();
}));
for(const [id,key,process] of [['addAttendance','attendance',f=>({date:f.get('date'),status:f.get('status')})],['addBehavior','notes',f=>({date:f.get('date'),rating:f.get('rating'),note:String(f.get('note')).trim()})],['addExercise','training',f=>({date:f.get('date'),exercise:String(f.get('exercise')).trim(),score:Number(f.get('score'))})]]){
$(id)?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);data[key][student]??=[];data[key][student].push(process(f));save();msg='Enregistré dans la maquette locale.';render()});
}
}
const params=new URLSearchParams(location.search);cls=params.get('classe')||'';student=params.get('id')||'';
if(location.pathname.endsWith('classe-details.html')&&!data.classes.includes(cls)){cls=data.classes[0]||''}
render();
})();