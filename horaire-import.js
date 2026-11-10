/* Top'Math import local photo/PDF. No network upload; OCR library loaded from CDN. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft=[],lastFileName='';
const weekdays=['','Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
const mapDays=[['lundi',1],['mardi',2],['mercredi',3],['jeudi',4],['vendredi',5]];
function status(message,bad=false){const el=$('scheduleImportStatus');if(el){el.textContent=message;el.classList.toggle('import-error',bad);}}
function loadScript(url,globalName){if(window[globalName])return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.async=true;script.onload=()=>window[globalName]?resolve():reject(Error('Bibliothèque indisponible'));script.onerror=()=>reject(Error('Connexion nécessaire pour charger le module de lecture.'));document.head.append(script);});}
async function ocr(image){await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js','Tesseract');const worker=await Tesseract.createWorker('fra+eng',1,{logger:m=>{if(m.status==='recognizing text')status('Lecture du document : '+Math.round(m.progress*100)+' %');}});try{return (await worker.recognize(image)).data.text||'';}finally{await worker.terminate();}}
async function extract(file){
 if(file.size>15*1024*1024)throw Error('Fichier trop volumineux (maximum 15 Mo).');
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdfjsLib');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  if(doc.numPages>8)throw Error('PDF limité à 8 pages pour cet import.');
  const texts=[];
  for(let i=1;i<=doc.numPages;i++){
   status('Lecture du PDF : page '+i+'/'+doc.numPages);
   const page=await doc.getPage(i),content=await page.getTextContent();
   const pieces=content.items.filter(x=>typeof x.str==='string').map(x=>({text:x.str.trim(),x:x.transform[4],y:x.transform[5]})).filter(x=>x.text);
   const lines=[];for(const part of pieces.sort((a,b)=>b.y-a.y||a.x-b.x)){let l=lines.find(l=>Math.abs(l.y-part.y)<4);if(!l){l={y:part.y,parts:[]};lines.push(l);}l.parts.push(part);}
   let text=lines.sort((a,b)=>b.y-a.y).map(l=>l.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' | ')).join('\n');
   if(text.replace(/\s/g,'').length<75){
    const viewport=page.getViewport({scale:2}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    text=await ocr(canvas);
   }
   texts.push(text);
  }
  return texts.join('\n');
 }
 if(file.type.startsWith('image/')||/\.(png|jpg|jpeg|webp|heic)$/i.test(file.name)){
  if(/\.heic$/i.test(file.name)&&!file.type.startsWith('image/'))throw Error('Convertissez la photo HEIC en JPEG ou PNG sur votre appareil.');
  return ocr(file);
 }
 throw Error('Utilisez une image JPG/PNG/WebP ou un PDF.');
}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function parseHours(text){
 const rows=[];const rex=/\b(?:([01]?\d|2[0-3])\s*[:hH.]\s*([0-5]\d))\b/g;let m;
 while((m=rex.exec(text))!==null){rows.push({index:m.index,time:m[1].padStart(2,'0')+':'+m[2]});}
 return rows;
}
function parseSchedule(text){
 const lines=text.split(/\r?\n/).map(clean).filter(Boolean),results=[];
 let daysInHeader=[];
 for(const line of lines.slice(0,30)){const present=mapDays.filter(([key])=>norm(line).includes(key));if(present.length>=2){daysInHeader=present.map(p=>p[1]);break;}}
 let activeDay=0,activePeriod=0;
 const reject=/\b(?:pause|diner|récréation|recreation|surveillance|début|fin|horaire|classe|mathématiques|mathematiques)\b/i;
 for(const line of lines){
  const n=norm(line);
  const dayMatches=mapDays.filter(([key])=>n.includes(key));
  if(dayMatches.length===1&&n.replace(/[^a-z]/g,'').length<30)activeDay=dayMatches[0][1];
  const periodMatch=n.match(/(?:p(?:ériode|eriode)?|heure|h)\s*[°o:]?\s*([1-9])\b|\b([1-9])\s*(?:ere|eme|e)\s*(?:heure|periode)/);
  if(periodMatch)activePeriod=Number(periodMatch[1]||periodMatch[2]);
  let cellMatches=[...line.matchAll(/(?:^|[;|,\t])\s*(?:([1-9])\s*[-.:]\s*)?((?:OBS(?:ERVATION)?\s*[A-Z]|P?[123]\s*(?:HORT|TB|MAC|CGO|ECO|TC|PC|AB|TM)|[123]\s+[A-Z]{1,5}(?:\s*\/\s*[123]\s*[A-Z]{1,5})?|DLC|TC))\s*(?=$|[;|,\t])/gi)];
  if(!cellMatches.length && activeDay && activePeriod && !reject.test(line) && line.length<65 && /(?:OBS|HORT|MAC|TB|CGO|TC|DLC|P[123])/i.test(line))cellMatches=[{1:null,2:line.trim()}];
  for(let i=0;i<cellMatches.length;i++){
   const m=cellMatches[i],period=Number(m[1]||activePeriod),day=activeDay|| (daysInHeader.length===1?daysInHeader[0]:0);
   if(day>=1&&day<=5&&period>=1&&period<=9){
    const classe=clean(m[2]).toUpperCase();if(!reject.test(classe)&&!results.some(x=>x.day===day&&x.period===period&&x.classe===classe))results.push({day,period,classe});
   }
  }
  // Also support explicit rows "Mardi 3 OBS E".
  const explicit=n.match(/\b(lundi|mardi|mercredi|jeudi|vendredi)\b[^\n]{0,25}?\b(?:p(?:eriode)?\s*)?([1-9])\b\s*[-:| ]+\s*(.+)$/);
  if(explicit){const day=mapDays.find(x=>x[0]===explicit[1])?.[1],period=Number(explicit[2]),classe=clean(explicit[3]).replace(/[|;].*$/,'').toUpperCase();if(day&&classe.length<65&&!reject.test(classe)&&!results.some(x=>x.day===day&&x.period===period))results.push({day,period,classe});}
 }
 return results;
}
function parsePhase(text){
 const lines=text.split(/\r?\n/).map(clean).filter(Boolean);
 const times=[];for(const line of lines){const cells=parseHours(line);if(cells.length>=2){times.push({start:cells[0].time,end:cells[1].time,line});}}
 // Only use structured rows when a phase and period can be identified with confidence.
 const first={},upper={};let group=null;
 for(const line of lines){const n=norm(line);if(/(?:obs|phase\s*1|p1|1re)/.test(n)&&/(?:horaire|phase|periode)/.test(n))group='first';if(/(?:p2|p3|phase\s*[23])/.test(n)&&/(?:horaire|phase|periode)/.test(n))group='upper';
 const p=n.match(/\b(?:p(?:eriode)?\s*|heure\s*)([1-9])\b/),hours=parseHours(line);
 if(group&&p&&hours.length>=2){const [start,end]=hours;if(start.time<end.time)(group==='first'?first:upper)[Number(p[1])]={start:start.time,end:end.time};}}
 return {first,upper,timesFound:times.length};
}
function rows(){return [...$('scheduleImportPreview').querySelectorAll('[data-import-row]')].map(row=>({day:Number(row.querySelector('[data-day]').value),period:Number(row.querySelector('[data-period]').value),classe:clean(row.querySelector('[data-classe]').value)})).filter(x=>x.day&&x.period&&x.classe);}
function showDraft(){const container=$('scheduleImportPreview');if(!draft.length){container.innerHTML='<p class="notice small">Aucun cours identifié avec assez de certitude. Vérifiez le texte ci-dessous et ajoutez les cours manuellement dans l’aperçu avant d’enregistrer.</p>';}else container.innerHTML='';
 for(const [i,x] of draft.entries())appendRow(x);
 $('scheduleImportActions').hidden=false;
}
function appendRow(x={day:2,period:1,classe:''}){
 const el=document.createElement('div');el.className='import-row';el.dataset.importRow='1';
 el.innerHTML='<select data-day aria-label="Jour du cours">'+weekdays.slice(1).map((d,i)=>'<option value="'+(i+1)+'"'+(x.day===i+1?' selected':'')+'>'+escape(d)+'</option>').join('')+'</select><select data-period aria-label="Période du cours">'+Array.from({length:9},(_,i)=>'<option value="'+(i+1)+'"'+(x.period===i+1?' selected':'')+'>P'+(i+1)+'</option>').join('')+'</select><input data-classe aria-label="Classe" maxlength="65" value="'+escape(x.classe)+'" placeholder="Classe"><button type="button" data-import-remove aria-label="Retirer cette ligne">✕</button>';
 $('scheduleImportPreview').append(el);
}
async function readFile(){
 const file=$('scheduleImportFile').files?.[0];if(!file){status('Choisissez une photo ou un PDF.',true);return;}
 $('scheduleImportRead').disabled=true;$('scheduleImportActions').hidden=true;
 try{
  status('Lecture de '+file.name+'…');lastFileName=file.name;
  const text=await extract(file);$('scheduleImportText').value=text;
  draft=parseSchedule(text);
  const phase=parsePhase(text);
  const phaseParts=['first','upper'].filter(g=>Object.keys(phase[g]).length>=3);
  if(phaseParts.length)status('Horaires détectés pour '+phaseParts.length+' groupe(s). Vérifiez et confirmez les données avant tout changement.');
  else status(draft.length?draft.length+' cours proposés. Vérifiez et corrigez le tableau avant d’enregistrer.':'Lecture terminée. Les cases du tableau ne sont pas assez claires : complétez les lignes manuellement.');
  showDraft();
 }catch(e){status('Import impossible : '+e.message,true);}finally{$('scheduleImportRead').disabled=false;}
}
function reparse(){draft=parseSchedule($('scheduleImportText').value);showDraft();status(draft.length+' cours proposés à vérifier.');}
function init(config){
 if(!$('scheduleImportRead'))return;
 const read=$('scheduleImportRead'),add=$('scheduleImportAdd'),parse=$('scheduleImportReparse');
 read.addEventListener('click',readFile);
 add.addEventListener('click',()=>appendRow());
 parse.addEventListener('click',reparse);
 $('scheduleImportPreview').addEventListener('click',event=>{const b=event.target.closest('[data-import-remove]');if(b)b.closest('[data-import-row]').remove();});
 $('scheduleImportSave').addEventListener('click',()=>{
  const proposed=rows();if(!proposed.length){status('Aucun cours à enregistrer.',true);return;}
  if(proposed.some(x=>x.classe.length>65)){status('Nom de classe trop long.',true);return;}
  const uniq=new Set();
  for(const r of proposed){const k=r.day+'-'+r.period;if(uniq.has(k)){status('Deux cours à la même période : '+weekdays[r.day]+' P'+r.period+'. Corrigez le tableau.',true);return;}uniq.add(k);}
  const mode=$('scheduleImportMode').value;
  if(!confirm((mode==='replace'?'Remplacer les cours de l’horaire actuel':'Ajouter les nouveaux cours')+' par '+proposed.length+' cours vérifiés ? Les liens et rapports seront conservés.'))return;
  config.apply(proposed,mode);status(proposed.length+' cours enregistrés. Les heures sont calculées selon la grille de chaque classe.');
 });
}
window.TopMathScheduleImport={init};
})();