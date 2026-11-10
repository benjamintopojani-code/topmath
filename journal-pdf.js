/* Top'Math — journal de classe annuel PDF A4 portrait, sans serveur. */
(function(){
'use strict';
function pdfText(v){
 const special={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
 return String(v??'').normalize('NFC').replace(/\u00a0/g,' ').replace(/[\u2010-\u2015]/g,'-').replace(/[\u200b-\u200d]/g,'').split('').map(c=>c.charCodeAt(0)<=255?c:(special[c]!==undefined?String.fromCharCode(special[c]):'?')).join('');
}
const esc=s=>pdfText(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function makePdf(entries,start,end){
 // PDF dessiné en coordonnées A4 ; couleurs pastel et cadres arrondis.
 const W=595.28,H=841.89,M=36,RIGHT=W-M,BOTTOM=51;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 const pages=[];let ops=[],y=0,pageNo=0,dayOpen='',hasLessons=false;
 const NAVY=[0.075,0.18,0.34],BLUE=[0.10,0.40,0.75],CYAN=[0.12,0.64,0.86];
 const PALE=[0.94,0.97,1],INK=[0.09,0.20,0.36],MUTED=[0.34,0.43,0.55],WHITE=[1,1,1];
 const palettes=[
  {main:[0.12,0.47,0.83],light:[0.93,0.97,1],line:[0.72,0.83,0.96]},
  {main:[0.19,0.62,0.43],light:[0.94,0.985,0.955],line:[0.70,0.86,0.77]},
  {main:[0.89,0.48,0.14],light:[1,0.965,0.93],line:[0.96,0.80,0.68]},
  {main:[0.52,0.33,0.73],light:[0.975,0.95,0.995],line:[0.84,0.76,0.92]},
  {main:[0.16,0.60,0.65],light:[0.935,0.985,0.99],line:[0.71,0.86,0.88]}
 ];
 const colors=c=>c.map(n=>Number(n).toFixed(3)).join(' ');
 const pos=(x,top)=>Number(x).toFixed(2)+' '+(H-top).toFixed(2);
 const fill=c=>ops.push(colors(c)+' rg');
 const stroke=c=>ops.push(colors(c)+' RG');
 function rounded(x,top,w,h,r,background,border=null,lw=.65){
  const b=H-top-h,k=.55228475,rr=Math.min(r,w/2,h/2),rx=rr*k;
  if(background)fill(background);if(border)stroke(border);
  ops.push(lw+' w');
  const path=[
   (x+rr)+' '+b+' m',(x+w-rr)+' '+b+' l',
   (x+w-rr+rx)+' '+b+' '+(x+w)+' '+(b+rr-rx)+' '+(x+w)+' '+(b+rr)+' c',
   (x+w)+' '+(b+h-rr)+' l',(x+w)+' '+(b+h-rr+rx)+' '+(x+w-rr+rx)+' '+(b+h)+' '+(x+w-rr)+' '+(b+h)+' c',
   (x+rr)+' '+(b+h)+' l',(x+rr-rx)+' '+(b+h)+' '+x+' '+(b+h-rr+rx)+' '+x+' '+(b+h-rr)+' c',
   x+' '+(b+rr)+' l',x+' '+(b+rr-rx)+' '+(x+rr-rx)+' '+b+' '+(x+rr)+' '+b+' c','h'
  ].join(' ');
  ops.push(path+' '+(background?(border?'B':'f'):'S'));
 }
 function rect(x,top,w,h,c){fill(c);ops.push(x+' '+(H-top-h)+' '+w+' '+h+' re f');}
 function text(x,top,value,size=10,bold=false,c=INK){
  fill(c);
  ops.push('BT /F'+(bold?2:1)+' '+size+' Tf '+pos(x,top)+' Td ('+esc(value)+') Tj ET');
 }
 function line(x1,y1,x2,y2,c=[.78,.84,.91]){stroke(c);ops.push('0.55 w '+pos(x1,y1)+' m '+pos(x2,y2)+' l S');}
 const fmt=v=>{const p=String(v||'').split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:v;};
 const dayName=v=>['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][new Date(v+'T12:00:00').getDay()];
 const wordWrap=(value,max)=>{
  const out=[];
  for(const para of String(value||'').replace(/\r/g,'').split('\n')){
   if(!para.trim()){out.push('');continue;}
   let t='';
   for(const w of para.trim().split(/\s+/)){
    if((t?t.length+1:0)+w.length+t.length>max&&t){out.push(t);t='';}
    if(w.length>max){if(t){out.push(t);t='';}for(let j=0;j<w.length;j+=max)out.push(w.slice(j,j+max));}
    else t+=(t?' ':'')+w;
   }
   if(t)out.push(t);
  }
  return out;
 };
 function emit(){
  if(!ops.length)return;
  const stream='q\n'+ops.join('\n')+'\nQ\n';
  const id=objects.length+1,cid=id+1;
  pages.push(id);
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+cid+' 0 R >>');
  objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
  ops=[];pageNo++;
 }
 // Page de garde : identité Top'Math lumineuse, sans surcharge.
 rect(0,0,W,H,[.985,.991,1]);
 rect(0,0,W,331,NAVY);
 // Bandeaux géométriques superposés, sobres et dynamiques.
 rounded(-58,229,410,108,34,[.10,.36,.67]);
 rounded(277,254,405,98,34,[.09,.53,.75]);
 rounded(374,295,245,29,13,[.29,.75,.83]);
 rounded(M,32,W-2*M,179,22,[.115,.265,.49],[.23,.40,.62],1);
 rounded(M+20,50,89,29,14,[.16,.64,.85]);
 text(M+33,69,"TOP'MATH",13,true,WHITE);
 text(M+20,113,'JOURNAL',32,true,WHITE);
 text(M+20,152,'DE CLASSE',32,true,WHITE);
 rect(M+20,174,170,4,[.28,.79,.9]);
 // Symboles mathématiques discrets dans un coin.
 rounded(RIGHT-108,67,74,74,15,[.18,.37,.60]);
 text(RIGHT-92,114,'x + y',19,true,WHITE);
 rounded(RIGHT-91,153,72,25,12,[.23,.62,.66]);
 text(RIGHT-78,170,'2026',11,true,WHITE);
 rounded(M+12,359,W-2*M-24,88,16,[.93,.965,1],[.75,.85,.96],.8);
 rounded(M+28,378,57,49,12,[.78,.87,.99]);
 text(M+38,410,'01/09',11,true,NAVY);
 text(M+104,391,'ANNEE SCOLAIRE',10,true,[.24,.40,.60]);
 text(M+104,420,start.slice(0,4)+' - '+(Number(start.slice(0,4))+1),23,true,NAVY);
 rounded(M+12,465,W-2*M-24,95,16,[.96,.975,.97],[.76,.87,.83],.8);
 rounded(M+28,485,57,53,12,[.77,.91,.86]);
 text(M+46,517,'E',23,true,[.16,.49,.39]);
 text(M+104,494,'ETABLISSEMENT',10,true,[.24,.40,.60]);
 text(M+104,523,'E.E.S.S.C.F. Le Chêneux',15,true,NAVY);
 text(M+104,540,'Amay',12,false,[.24,.40,.60]);
 // Pastilles de couleurs, comme les cartes des cours.
 rounded(M+20,592,95,29,14,[.88,.94,1],[.72,.84,.97]);
 text(M+36,610,'Maths',11,true,[.13,.38,.7]);
 rounded(M+127,592,115,29,14,[.90,.965,.93],[.75,.87,.78]);
 text(M+142,610,'Activités',11,true,[.16,.48,.32]);
 rounded(M+254,592,104,29,14,[1,.945,.89],[.96,.84,.71]);
 text(M+266,610,'Suivi',11,true,[.64,.35,.14]);
 text(M+20,666,'Un journal clair, jour après jour.',15,true,NAVY);
 text(M+20,691,'Cours et apprentissages classés par date et par période.',10,false,MUTED);
 text(M+20,714,'Du '+fmt(start)+' au '+fmt(end),10,false,MUTED);
 line(M,766,RIGHT,766,[.71,.81,.92]);
 text(M,789,"Top'Math  |  Journal de classe",8,false,MUTED);
 text(RIGHT-112,789,'Page de garde',8,false,MUTED);
 emit();
 const topPage=()=>{
  rounded(M,27,W-2*M,53,10,NAVY);
  text(M+16,48,"TOP'MATH",15,true,WHITE);
  text(M+181,48,'Journal de classe',13,true,WHITE);
  text(RIGHT-104,67,start.slice(0,4)+' - '+(Number(start.slice(0,4))+1),9,false,WHITE);
  y=101;
 };
 function nextPage(){
  if(ops.length){
   line(M,H-48,RIGHT,H-48);
   text(M,H-30,"Journal de classe - Top'Math",8,false,MUTED);
   text(RIGHT-50,H-30,'Page '+(pageNo+1),8,false,MUTED);
   emit();
  }
  topPage();dayOpen='';
 }
 const byDate=new Map();
 for(const ent of entries){
  if(!byDate.has(ent.date))byDate.set(ent.date,[]);
  byDate.get(ent.date).push(ent);
 }
 const classNames=[...new Set(entries.map(e=>e.classe||''))].sort((a,b)=>a.localeCompare(b,'fr'));
 const classColor=new Map(classNames.map((c,i)=>[c,palettes[i%palettes.length]]));
 function dayTitle(date){
  rounded(M,y,W-2*M,33,9,[.86,.92,.985],[.75,.84,.95]);
  rect(M+1,y+1,5,31,BLUE);
  text(M+14,y+22,dayName(date)+' '+fmt(date),12,true,NAVY);
  y+=43;dayOpen=date;
 }
 nextPage();hasLessons=true;
 for(const [date,lessons] of byDate){
  // Le titre d'une journée ne reste jamais seul en bas de page.
  if(y+92>H-BOTTOM)nextPage();
  if(dayOpen!==date)dayTitle(date);
  for(const lesson of lessons){
   const palette=classColor.get(lesson.classe||'')||palettes[0];
   const allLines=wordWrap(lesson.text,68);
   const lines=allLines.length?allLines:[''];
   const label='P'+String(lesson.period||'?');
   let offset=0;
   while(offset<lines.length){
    const free=H-BOTTOM-y;
    if(free<57){nextPage();dayTitle(date); }
    const capacity=Math.max(1,Math.floor((H-BOTTOM-y-24)/13));
    const chunk=lines.slice(offset,offset+capacity);offset+=chunk.length;
    const h=Math.max(41,chunk.length*13+21);
    rounded(M,y,W-2*M,h,8,palette.light,palette.line);
    rect(M+1,y+1,5,h-2,palette.main);
    rounded(M+10,y+8,34,24,5,palette.main);
    text(M+16,y+24,label.slice(0,4),10.4,true,WHITE);
    text(M+52,y+24,(lesson.classe||'Sans classe').slice(0,18),10.2,true,NAVY);
    line(M+154,y+7,M+154,y+h-7,palette.line);
    chunk.forEach((row,i)=>text(M+164,y+19+i*13,row,9.5,false,INK));
    y+=h+9;
    if(offset<lines.length){nextPage();dayTitle(date);}
   }
  }
  y+=7;
 }
 if(!hasLessons){text(M,y+15,'Aucun cours enregistré.',11,false,INK);}
 if(ops.length)nextPage();
 // nextPage() above initializes a new blank header; remove uncommitted ops.
 ops=[];
 objects[1]='<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map(id=>id+' 0 R').join(' ')+'] >>';
 let out='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offs=[0];
 objects.forEach((o,i)=>{offs.push(out.length);out+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
 const xref=out.length;out+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<=objects.length;i++)out+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
 out+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 const bin=new Uint8Array(out.length);for(let i=0;i<out.length;i++)bin[i]=out.charCodeAt(i)&255;
 return new Blob([bin],{type:'application/pdf'});
}
function monday(date){
 const d=new Date(String(date||'').slice(0,10)+'T12:00:00');if(!Number.isFinite(d.getTime()))throw Error('Date de semaine invalide.');
 d.setDate(d.getDate()-(d.getDay()+6)%7);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function plusDays(date,n){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function exportWeek(date,raw){
 const start=monday(date),end=plusDays(start,6);
 const entries=Object.values(raw||{}).filter(x=>x&&x.date>=start&&x.date<=end&&String(x.text||'').trim())
  .sort((a,b)=>a.date.localeCompare(b.date)||Number(a.period)-Number(b.period)||(a.classe||'').localeCompare(b.classe||'','fr'));
 if(!entries.length)throw Error('Aucune note de cours enregistrée cette semaine. Choisis une autre semaine.');
 const blob=makePdf(entries,start,end),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='TopMath-Journal-semaine-'+start+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return {start,end,count:entries.length};
}
function exportSchoolYear(date,raw){
 const point=String(date||new Date().toISOString().slice(0,10));
 const year=Number(point.slice(5,7))>=9?Number(point.slice(0,4)):Number(point.slice(0,4))-1;
 const start=year+'-09-01',end=point;
 const entries=Object.values(raw||{}).filter(x=>x&&x.date>=start&&x.date<=end&&String(x.text||'').trim())
  .sort((a,b)=>a.date.localeCompare(b.date)||Number(a.period)-Number(b.period)||(a.classe||'').localeCompare(b.classe||'','fr'));
 if(!entries.length)throw Error("Aucun cours redige depuis le 1er septembre "+year+".");
 const blob=makePdf(entries,start,end),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='TopMath-Journal-de-classe-'+year+'-'+(year+1)+'.pdf';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return {start,end,count:entries.length,classes:new Set(entries.map(x=>x.classe)).size};
}
window.TopMathJournalPdf={exportSchoolYear,exportWeek,monday,plusDays,makePdf};
})();