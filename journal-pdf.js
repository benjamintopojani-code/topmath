/* Top'Math — export hebdomadaire du journal en PDF A4 portrait, sans serveur. */
(function(){
'use strict';
function pdfText(v){
 const special={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
 return String(v??'').normalize('NFC').replace(/\u00a0/g,' ').replace(/[\u2010-\u2015]/g,'-').replace(/[\u200b-\u200d]/g,'').split('').map(c=>c.charCodeAt(0)<=255?c:(special[c]!==undefined?String.fromCharCode(special[c]):'?')).join('');
}
const esc=s=>pdfText(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function makePdf(entries,start,end){
 const A4W=595.28,A4H=841.89,LM=47,RM=47,TOP=56,BOTTOM=54;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 let pages=[],lines=[],y=TOP,dayBefore='',pageNum=0;
 const tx=(x,v,size=10,bold=false)=>{lines.push('BT /F'+(bold?'2':'1')+' '+size+' Tf '+x.toFixed(2)+' '+(A4H-y).toFixed(2)+' Td ('+esc(v)+') Tj ET');};
 const rule=()=>{lines.push('0.78 0.84 0.91 RG 0.7 w '+LM+' '+(A4H-y).toFixed(2)+' m '+(A4W-RM)+' '+(A4H-y).toFixed(2)+' l S 0 0 0 RG');};
 const head=()=>{y=TOP;tx(LM,"TOP'MATH  /  JOURNAL DE CLASSE",15,true);y+=20;tx(LM,'Semaine du '+format(start)+' au '+format(end),10);y+=18;rule();y+=20;};
 const page=()=>{
  if(!lines.length)return;
  y=A4H-34;tx(LM,'Document personnel  -  Export du '+new Date().toLocaleDateString('fr-BE'),8);
  tx(A4W-RM-54,'Page '+(pageNum+1),8);
  const stream='0 0 0 RG\n'+lines.join('\n')+'\n';
  const id=objects.length+1,cid=id+1;pages.push(id);objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+A4W+' '+A4H+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+cid+' 0 R >>');
  objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
  lines=[];pageNum++;
 };
 const ensure=(height)=>{if(y+height>A4H-BOTTOM){page();head();dayBefore='';}};
 const wrap=(value,max)=>{
  const out=[];
  for(const paragraph of String(value??'').replace(/\r/g,'').split('\n')){
   if(!paragraph.trim()){out.push('');continue;}
   let line='';
   for(const word of paragraph.split(/\s+/).filter(Boolean)){
    if((line+' '+word).length>max&&line){out.push(line);line='';}
    if(word.length>max){if(line){out.push(line);line='';}for(let i=0;i<word.length;i+=max)out.push(word.slice(i,i+max));}
    else line+=(line?' ':'')+word;
   }
   if(line)out.push(line);
  }
  return out.length?out:[''];
 };
 const format=s=>{const d=String(s||'').split('-');return d.length===3?d[2]+'/'+d[1]+'/'+d[0]:String(s);};
 const weekdays=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
 const dayLabel=date=>{const d=new Date(date+'T12:00:00');return weekdays[d.getDay()]+' '+format(date);};
 head();
 if(!entries.length){tx(LM,'Aucun cours rédigé pour cette semaine.',11);y+=20;}
 else for(const ent of entries){
  if(ent.date!==dayBefore){ensure(49);if(dayBefore){y+=6;}tx(LM,dayLabel(ent.date).toUpperCase(),11,true);y+=8;rule();y+=19;dayBefore=ent.date;}
  const title=(ent.classe||'Classe non précisée')+'   ·   Période '+(ent.period||'?');
  ensure(44);tx(LM,title,10.6,true);y+=15;
  for(const line of wrap(ent.text||'',94)){
   ensure(13);if(line)tx(LM+8,line,9.6);y+=13;
  }
  y+=17;
 }
 page();
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
window.TopMathJournalPdf={exportWeek,monday,plusDays,makePdf};
})();