/* Top'Math — export autonome PDF A4 paysage des présences.
   Aucune bibliothèque externe : export direct sur iPad et navigateur. */
(function(){
'use strict';
function win(s){
 return String(s??'').replace(/[\u2010-\u2015]/g,'-').replace(/\u2026/g,'...')
  .replace(/[\u00A0\u202F]/g,' ').replace(/[^\x20-\x7e\u00a0-\u00ff\u20ac\u2018\u2019\u201c\u201d\u0152\u0153\u201a\u201e\u2020\u2021\u2022\u2013\u2014\u2030\u0160\u0161\u017d\u017e\u0178]/g,'?')
  .replace(/[\u20ac\u2018\u2019\u201c\u201d\u0152\u0153\u201a\u201e\u2020\u2021\u2022\u2013\u2014\u2030\u0160\u0161\u017d\u017e\u0178]/g,c=>{
   const map={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
   return String.fromCharCode(map[c]||63);
  });
}
function pdfEscape(s){return win(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function safeName(s){return String(s).replace(/[^a-z0-9_-]+/gi,'-').slice(0,55)||'classe';}
function pdfBytes(objects,root){
 let content='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offsets=[0];
 const count=objects.length;
 for(let i=0;i<count;i++){offsets.push(content.length);content+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=content.length;
 content+='xref\n0 '+(count+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<=count;i++)content+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 content+='trailer\n<< /Size '+(count+1)+' /Root '+root+' 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 const bytes=new Uint8Array(content.length);for(let i=0;i<content.length;i++)bytes[i]=content.charCodeAt(i)&255;
 return new Blob([bytes],{type:'application/pdf'});
}
function generate(classe,names,allSessions){
 const sessions=allSessions.filter(s=>s&&s.classe===classe&&Array.isArray(s.entries))
  .sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.period)-Number(b.period));
 if(!sessions.length)throw Error('Aucun appel enregistré pour cette classe.');
 const students=[...new Set([...names,...sessions.flatMap(s=>s.entries.map(e=>e.name))])].filter(Boolean)
  .sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
 if(!students.length)throw Error('Aucun élève trouvé dans les appels enregistrés.');
 const W=842,H=595,margin=27,firstCol=180,perPage=10,cellWidth=(W-2*margin-firstCol)/perPage;
 const startY=104,headerH=37,rowH=16,rowsPerPage=Math.floor((H-startY-headerH-48)/rowH);
 const pagesX=Math.ceil(sessions.length/perPage),pagesY=Math.ceil(students.length/rowsPerPage);
 const totalPages=pagesX*pagesY;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 const pageIds=[];
 const T=(x,y,str,size=9,bold=false)=>'BT /F'+(bold?'2':'1')+' '+size+' Tf '+x.toFixed(2)+' '+(H-y).toFixed(2)+' Td ('+pdfEscape(str)+') Tj ET\n';
 const L=(x1,y1,x2,y2)=>x1.toFixed(2)+' '+(H-y1).toFixed(2)+' m '+x2.toFixed(2)+' '+(H-y2).toFixed(2)+' l S\n';
 const F=(x,y,w,h,r,g,b)=>r+' '+g+' '+b+' rg '+x.toFixed(2)+' '+(H-y-h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re f\n0 0 0 RG\n';
 const truncate=(str,max)=>str.length>max?str.slice(0,max-3)+'...':str;
 const dateLabel=s=>{let x=String(s.date||'');return /^\d{4}-\d{2}-\d{2}$/.test(x)?x.slice(8)+'/'+x.slice(5,7)+'/'+x.slice(2,4):x;};
 let pageNo=0;
 for(let xpage=0;xpage<pagesX;xpage++)for(let ypage=0;ypage<pagesY;ypage++){
  pageNo++;const sessionsPage=sessions.slice(xpage*perPage,(xpage+1)*perPage);
  const studentsPage=students.slice(ypage*rowsPerPage,(ypage+1)*rowsPerPage);
  let stream='0.55 w\n0 0 0 RG\n';
  stream+=T(margin,39,'TOP\'MATH  /  HISTORIQUE DES PRESENCES',14,true);
  stream+=T(margin,58,'Classe : '+truncate(classe,65),11,true);
  stream+=T(margin,76,students.length+' eleves  -  '+sessions.length+' cours enregistres  -  '+new Date().toLocaleDateString('fr-BE'),8);
  stream+=F(margin,startY,W-2*margin,headerH,0.89,0.94,1);
  stream+=T(margin+8,startY+23,'ELEVES',9,true);
  for(let j=0;j<sessionsPage.length;j++){
   const x=margin+firstCol+j*cellWidth;
   stream+=T(x+5,startY+15,dateLabel(sessionsPage[j]),8,true);
   stream+=T(x+5,startY+30,'Periode '+String(sessionsPage[j].period||'?'),7);
  }
  for(let i=0;i<studentsPage.length;i++){
   const y=startY+headerH+i*rowH,name=studentsPage[i];
   if(i%2===0)stream+=F(margin,y,W-2*margin,rowH,0.965,0.98,1);
   stream+=T(margin+7,y+11.5,truncate(name,29),8.1,i%2===0);
   for(let j=0;j<sessionsPage.length;j++){
    const status=sessionsPage[j].entries.find(e=>e.name===name)?.status||'';
    const sym=({P:'P',A:'A',S:'S',R:'R'})[status]||'';
    if(sym)stream+=T(margin+firstCol+j*cellWidth+cellWidth/2-3,y+11.5,sym,8.5,true);
   }
  }
  const bottom=startY+headerH+studentsPage.length*rowH;
  const boundaries=[margin,margin+firstCol];
  for(let j=1;j<=sessionsPage.length;j++)boundaries.push(margin+firstCol+j*cellWidth);
  stream+='0.72 0.79 0.87 RG\n';
  for(const x of boundaries)stream+=L(x,startY,x,bottom);
  for(let i=0;i<=studentsPage.length;i++)stream+=L(margin,startY+headerH+i*rowH,margin+firstCol+sessionsPage.length*cellWidth,startY+headerH+i*rowH);
  stream+=L(margin,startY,margin+firstCol+sessionsPage.length*cellWidth,startY);
  stream+='0 0 0 RG\n';
  stream+=T(margin,H-30,'P : Present     A : Absent     S : Stage     R : Retard     Case vide : non renseigne',8);
  stream+=T(W-112,H-30,'Page '+pageNo+'/'+totalPages,8);
  const pageId=objects.length+1,streamId=pageId+1;pageIds.push(pageId);
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+streamId+' 0 R >>');
  objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
 }
 objects[1]='<< /Type /Pages /Count '+pageIds.length+' /Kids ['+pageIds.map(n=>n+' 0 R').join(' ')+'] >>';
 return pdfBytes(objects,1);
}
function download(classe,names,sessions){
 const blob=generate(classe,names,sessions),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='topmath-presences-'+safeName(classe)+'-'+new Date().toISOString().slice(0,10)+'.pdf';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
window.TopMathAttendancePdf={download};
})();