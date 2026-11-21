'use strict';
// Non-destructive regression suite for the historical Top'Math engine.
// Runs against checked-in source and fake D1. Never accesses a network or production data.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ResponseMock={json:(body,opts={})=>({status:opts.status||200,body})};
let nextId=0;
function route(file){
  const src=read(file).replace(/export\s+async\s+function\s+onRequestPost/,'async function onRequestPost');
  return new Function('Response','crypto',src+'\nreturn onRequestPost;')(ResponseMock,{randomUUID:()=>`test-${++nextId}`});
}
function stmt(sql,args=[]){
  return {
    sql,args,
    bind(...a){return stmt(sql,a)}
  };
}
function req(body,db){return {request:{json:async()=>body},env:{DB:db}};}
function mockEvalDB(){
  let records=[];
  const db={
    prepare(sql){return {...stmt(sql),bind(...args){return{
      ...stmt(sql,args),
      async first(){
        if(/FROM enrollments/i.test(sql))return {school_year_id:'y1',phase:'Phase 1',track:'NORMAL'};
        if(/FROM competencies/i.test(sql))return {id:'competency1',code:'N104'};
        if(/FROM official_evaluations/i.test(sql))return records.find(r=>r.no===args[3])||null;
        return null;
      },
      async all(){return {results:records.map(r=>({evaluation_no:r.no,evaluation_date:r.date,is_cancelled:r.cancelled}))}}
    }}}},
    async batch(statements){
      for(const x of statements){
        if(/INSERT INTO official_evaluations/i.test(x.sql))records.push({id:x.args[0],no:x.args[4],date:x.args[5],cancelled:0});
        else if(/SET evaluation_date/i.test(x.sql)){const r=records.find(r=>r.id===x.args[1]);r.date=x.args[0];r.cancelled=0;}
        else if(/SET is_cancelled/i.test(x.sql))records.find(r=>r.id===x.args[0]).cancelled=1;
      }
    }
  };
  return {db,active:()=>records.filter(r=>!r.cancelled),all:()=>records};
}
function statusFunction(){
  const html=read('enseignant.html');
  new Function(html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)[1]);
  const from=html.indexOf('function normalizeCompetencyDates(');
  const to=html.indexOf('function competencyStateFromEntry(',from);
  assert(from>=0&&to>from,'historical competency engine is present');
  return new Function(html.slice(from,to)+'\nreturn competencyStatusFromDates;')();
}
test('historical teacher JavaScript parses',()=>{const html=read('enseignant.html');assert.match(html,/function computedStudentProgress/);assert.match(html,/function buildDynamicOfficialPdfBlob/);statusFunction();});
test('3 dated evaluations are the unique criterion for certification',()=>{
  const status=statusFunction();
  assert.equal(status(['','','']),'Pas commencé');
  assert.equal(status(['01/09/26','','']),'En cours');
  assert.equal(status(['01/09/26','20/09/26','']),'En cours');
  assert.equal(status(['01/09/26','20/09/26','05/10/26']),'Validé');
  assert.equal(status(['01/09/26','','05/10/26']),'En cours');
});
test('official PDF uses the same dates and identity as student progress',()=>{
  const html=read('enseignant.html');
  const start=html.indexOf('function buildMasterOverlayStream(');
  const end=html.indexOf('function buildDynamicOfficialPdfBlob(',start);
  assert(start>=0&&end>start);
  const f=new Function('officialTemplateKey','MASTER_COLS','MASTER_FORM_MAP','MASTER_IDENTITY_FIELDS','officialIdentityValue','pdfLeftText','pdfCenteredText','getSchoolState','phaseNumber','computedStudentProgress','competencyStatusFromDates',html.slice(start,end)+'return buildMasterOverlayStream;')(
    ()=> 'NORMAL',{NORMAL:[[0,100],[100,200],[200,300],[300,400]]},
    {NORMAL:{N104:{page:2,y0:100,y1:130}}},
    [{key:'first',x0:10,y0:20,y1:35,size:12}],
    (s,key)=>s[key],s=>'IDENT:'+s+' ',s=>'CELL:'+s+' ',
    ()=>({active:'2026-2027'}),()=>1,s=>s.progress,statusFunction()
  );
  const pupil={first:'Camille',progress:{N104:[['10/09/26','02/10/26','03/11/26'],'Validé']}};
  assert.match(f(pupil,1),/IDENT:Camille/);
  assert.match(f(pupil,1),/CELL:2026-2027/);
  const pdf=f(pupil,2);
  for(const date of ['10/09/26','02/10/26','03/11/26'])assert(pdf.includes(date));
  assert.match(pdf,/CELL:Validé/);
  pupil.progress.N104=[['10/09/26','','03/11/26'],'En cours'];
  assert.doesNotMatch(f(pupil,2),/02\/10\/26/);
  assert.match(f(pupil,2),/CELL:En cours/);
});
test('D1 evaluation endpoint handles additions and cancellations of all three dates',async()=>{
  const handler=route('functions/api/evaluation-edit.js');
  const m=mockEvalDB();
  for(const [dates,expected] of [
    [['2026-09-10','',''],1],
    [['2026-09-10','2026-10-02',''],2],
    [['2026-09-10','2026-10-02','2026-11-03'],3],
    [['2026-09-10','','2026-11-03'],2],
    [['','',''],0]
  ]){
    const res=await handler(req({student_id:'test-pupil',competency_code:'N104',dates},m.db));
    assert.equal(res.status,200);
    assert.equal(res.body.ok,true);
    assert.equal(m.active().length,expected);
  }
});
test('D1 evaluation endpoint rejects malformed input',async()=>{
  const handler=route('functions/api/evaluation-edit.js'),m=mockEvalDB();
  for(const data of [
    {student_id:'',competency_code:'N104',dates:['','','']},
    {student_id:'p1',competency_code:'N104',dates:['2026-02-30','','']},
    {student_id:'p1',competency_code:'N104',dates:['2026-01-01','2026-02-01']}
  ])assert.equal((await handler(req(data,m.db))).status,400);
  assert.equal(m.all().length,0);
});
test('year deletion cannot remove planning of other years using student ID alone',()=>{
  const source=read('functions/api/year-manage.js');
  assert.doesNotMatch(source,/DELETE FROM evaluation_schedule_overrides WHERE student_id IN/i);
  assert.match(source,/DELETE FROM official_evaluations WHERE school_year_id/);
});
test('year and student forms reject invalid inputs',async()=>{
  const year=route('functions/api/year-manage.js');
  const pupil=route('functions/api/student-save.js');
  for(const body of [{action:'create',label:'2026/2027'},{action:'delete',year_id:''}])assert.equal((await year(req(body,{}))).status,400);
  for(const body of [
    {first_name:'',last_name:'Démo',class_id:'c1'},
    {first_name:'Éva',last_name:'Démo',class_id:'c1',birth_date:'2026-02-30'}
  ])assert.equal((await pupil(req(body,{}))).status,400);
});
test('Tech Premium pages link to the original teacher engine',()=>{
  for(const name of ['mes-classes.html','evaluations-a-venir.html','gestion-competences-eleves.html','ouverture-competences.html','fiche-officielle-competences.html']){
    assert.match(read(name),/src="enseignant\.html"/,name);
    assert.match(read(name),/topmath-legacy-bridge\.js/,name);
  }
  assert.match(read('competences-enseignant.html'),/fiche-officielle-competences\.html/);
});


test('official PDF writer generates a four-page PDF structure without real data',async()=>{
  const html=read('enseignant.html');
  const start=html.indexOf('function buildDynamicOfficialPdfBlob(');
  const end=html.indexOf('function previewOverlayElement(',start);
  assert(start>=0&&end>start);
  const bytes=s=>new TextEncoder().encode(s);
  const concat=pieces=>{const out=new Uint8Array(pieces.reduce((n,x)=>n+x.length,0));let at=0;for(const x of pieces){out.set(x,at);at+=x.length}return out};
  const make=new Function('D1_PEDAGOGICAL_ROSTER','pedagogicalStudents','activeStudents','officialTemplateKey','MASTER_JPEG_BASE64','base64ToBytes','asciiBytes','concatBytes','buildMasterOverlayStream','Blob',html.slice(start,end)+'return buildDynamicOfficialPdfBlob;')(
    null,()=>({}),()=>({p1:{id:'p1',first:'Test',name:'Eleve',progress:{}}}),
    ()=>'NORMAL',{NORMAL:{'1':'AA==','2':'AA==','3':'AA==','4':'AA=='}},
    b64=>new Uint8Array(Buffer.from(b64,'base64')),bytes,concat,
    (s,page)=>page===1?'BT /F1 12 Tf (TEST) Tj ET ':'',
    Blob
  );
  const pdf=make('p1');
  assert.equal(pdf.type,'application/pdf');
  const arr=Buffer.from(await pdf.arrayBuffer());
  const str=arr.toString('latin1');
  assert.match(str,/^%PDF-1\.4/);
  assert.match(str,/\/Type \/Pages \/Count 4/);
  assert.match(str,/xref\s+0 16/);
  assert.match(str,/startxref/);
  assert.match(str,/%%EOF$/);
});
