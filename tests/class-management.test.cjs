'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ResponseMock={json:(body,init={})=>({body,status:init.status||200})};
let n=0;
function route(p){const source=fs.readFileSync(path.join(root,p),'utf8').replace('export async function onRequestPost','async function onRequestPost');return new Function('Response','crypto',source+';return onRequestPost;')(ResponseMock,{randomUUID:()=>`id-${++n}`});}
const req=(db,body)=>({env:{DB:db},request:{json:async()=>body}});
function fakeDB(){
 const years=[{id:'year-current',label:'2026-2027'}];
 let classes=[{id:'class-one',school_year_id:'year-current',name:'Observation B',track:'NORMAL',phase:'Phase 1'}];
 let enrollments=[{student_id:'pupil-1',school_year_id:'year-current',class_id:null,phase:'Phase 1'}];
 let schedules=[{class_id:'class-one'}],exceptions=[{class_id:'class-one'}];
 const executed=[];
 const stmt=(sql,args=[])=>({
  sql,args,bind(...a){return stmt(sql,a)},
  async first(){
   const u=sql.toUpperCase();
   if(u.includes('FROM SCHOOL_YEARS'))return years[0];
   if(u.includes('SELECT ID FROM CLASSES')&&u.includes('LOWER(NAME)'))return classes.find(c=>c.school_year_id===args[0]&&c.name.toLowerCase()===String(args[1]).toLowerCase()&&(!args[2]||c.id!==args[2]))||null;
   if(u.includes('FROM CLASSES'))return classes.find(c=>c.id===args[0]&&c.school_year_id===args[1])||null;
   if(u.includes('COUNT(*) AS N FROM ENROLLMENTS'))return {n:enrollments.filter(e=>e.class_id===args[1]).length};
   return null;
  },
  async run(){apply({sql,args});return {meta:{changes:1}}}
 });
 function apply(statement){
  const {sql,args}=statement;executed.push(statement);
  if(sql.includes('INSERT INTO classes'))classes.push({id:args[0],school_year_id:args[1],name:args[2],track:args[3],phase:args[4]});
  else if(sql.includes('UPDATE classes SET name=')){const c=classes.find(c=>c.id===args[1]);if(c)c.name=args[0]}
  else if(sql.includes('DELETE FROM classes'))classes=classes.filter(c=>c.id!==args[0]);
  else if(sql.includes('UPDATE enrollments SET class_id=NULL'))enrollments.filter(e=>e.class_id===args[1]&&e.school_year_id===args[0]).forEach(e=>e.class_id=null);
  else if(sql.includes('UPDATE enrollments')&&sql.includes('class_id IS NULL')){let changed=0;enrollments.filter(e=>e.school_year_id===args[2]&&e.student_id===args[3]&&!e.class_id).forEach(e=>{e.class_id=args[0];changed++});return changed}
  else if(sql.includes('DELETE FROM class_schedule'))schedules=schedules.filter(s=>s.class_id!==args[0]);
  else if(sql.includes('DELETE FROM calendar_exceptions'))exceptions=exceptions.filter(s=>s.class_id!==args[1]);
 }
 return {db:{prepare:sql=>stmt(sql),async batch(stmts){return stmts.map(s=>({meta:{changes:apply(s)||0}}))}},get:()=>({classes,enrollments,schedules,exceptions,executed})};
}
test('class management creates and renames without deleting pupils',async()=>{
 const h=route('functions/api/class-manage.js'),m=fakeDB();
 const create=await h(req(m.db,{action:'create',name:'P2 Horticulture',phase:'Phase 2',track:'NORMAL'}));
 assert.equal(create.status,200);
 assert.equal(m.get().classes.length,2);
 const c=create.body.class;
 const rename=await h(req(m.db,{action:'rename',class_id:c.id,name:'P2 Hort'}));
 assert.equal(rename.status,200);
 assert.equal(m.get().classes.find(x=>x.id===c.id).name,'P2 Hort');
 assert.equal(m.get().enrollments.length,1);
});
test('class deletion unassigns pupils and preserves their enrollment record',async()=>{
 const m=fakeDB(),assign=route('functions/api/assign-students.js'),klass=route('functions/api/class-manage.js');
 // Assigning an unassigned pupil occurs via an UPDATE with class_id IS NULL.
 const r=await assign(req(m.db,{class_id:'class-one',student_ids:['pupil-1']}));
 assert.equal(r.status,200);
 assert.equal(m.get().enrollments[0].class_id,'class-one');
 const deleted=await klass(req(m.db,{action:'delete',class_id:'class-one'}));
 assert.equal(deleted.status,200);
 assert.equal(m.get().classes.length,0);
 assert.equal(m.get().enrollments.length,1);
 assert.equal(m.get().enrollments[0].student_id,'pupil-1');
 assert.equal(m.get().enrollments[0].class_id,null);
});
test('class management rejects empty names and missing identifiers',async()=>{
 const h=route('functions/api/class-manage.js'),m=fakeDB();
 assert.equal((await h(req(m.db,{action:'create',name:''}))).status,400);
 assert.equal((await h(req(m.db,{action:'delete',class_id:''}))).status,400);
});
