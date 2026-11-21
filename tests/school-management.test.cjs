'use strict';
// Positive API scenarios with strictly simulated D1. Does not contact Cloudflare.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Resp={json:(body,options={})=>({body,status:options.status||200})};
let counter=0;
function api(file){
  const source=fs.readFileSync(path.join(root,file),'utf8').replace('export async function onRequestPost','async function onRequestPost');
  return new Function('Response','crypto',source+'\nreturn onRequestPost;')(Resp,{randomUUID:()=>`demo-${++counter}`});
}
function mockStudentDB(){
  const students=new Map(),enrollments=new Map();
  function prepare(sql,args=[]){
    const entry={
      sql,args,bind(...more){return prepare(sql,more)},
      async first(){
        const q=sql.toUpperCase();
        if(q.includes('FROM SCHOOL_YEARS'))return{id:'year-demo'};
        if(q.includes('FROM CLASSES'))return args[0]==='class-demo'?{id:'class-demo',track:'NORMAL',phase:'Phase 1'}:null;
        if(q.includes('FROM STUDENTS'))return students.get(args[0])||null;
        if(q.includes('FROM ENROLLMENTS'))return enrollments.get(args[0])||null;
        return null;
      },
      async run(){apply(entry);return{}}
    };
    return entry;
  }
  function apply(statement){
    const {sql,args}=statement;
    if(sql.includes('INSERT INTO students'))students.set(args[0],{id:args[0],first:args[2],last:args[1],birth:args[3]});
    if(sql.includes('INSERT INTO enrollments'))enrollments.set(args[1],{id:args[0],class:args[2]});
    if(sql.includes('UPDATE students')){const s=students.get(args[3]);Object.assign(s,{first:args[0],last:args[1],birth:args[2]})}
    if(sql.includes('UPDATE enrollments')){for(const e of enrollments.values())if(e.id===args[5])e.class=args[0]}
  }
  return {db:{prepare,async batch(statements){statements.forEach(apply)}},students,enrollments};
}
test('D1 student save: create, update and validate dates',async()=>{
  const f=api('functions/api/student-save.js'),m=mockStudentDB();
  const data={student_id:'',first_name:'Camille',last_name:'Test',birth_date:'2012-07-12',class_id:'class-demo',phase:'Phase 1'};
  const request=body=>({env:{DB:m.db},request:{json:async()=>body}});
  const newStudent=await f(request(data));
  assert.equal(newStudent.status,200);
  assert.equal(m.students.size,1);
  assert.equal(m.enrollments.size,1);
  const sid=newStudent.body.student_id;
  const changed=await f(request({...data,student_id:sid,first_name:'Camilla'}));
  assert.equal(changed.status,200);
  assert.equal(m.students.get(sid).first,'Camilla');
  const invalid=await f(request({...data,student_id:'',birth_date:'2012-02-30'}));
  assert.equal(invalid.status,400);
  assert.equal(m.students.size,1);
});
function mockYearDB(){
  let years=[{id:'year-old',label:'2025-2026',is_active:1},{id:'year-older',label:'2024-2025',is_active:0}];
  const executed=[];
  function prepare(sql,args=[]){
    const st={
      sql,args,bind(...a){return prepare(sql,a)},
      async first(){
        if(sql.includes('WHERE id=?'))return years.find(y=>y.id===args[0])||null;
        if(sql.includes('FROM school_years ORDER BY'))return years[0]||null;
        return null
      },
      async all(){
        if(sql.includes('SELECT label FROM school_years'))return{results:years.filter(y=>y.label===args[0]||y.label.startsWith(args[0]+' ('))};
        if(sql.includes('SELECT id FROM classes'))return{results:[{id:'class-old'}]};
        return{results:[]}
      },
      async run(){apply(st);return{}}
    };
    return st;
  }
  function apply(s){
    executed.push(s);
    if(s.sql.includes('UPDATE school_years SET is_active=0'))years.forEach(y=>y.is_active=0);
    if(s.sql.includes('INSERT INTO school_years'))years.push({id:s.args[0],label:s.args[1],is_active:1});
    if(s.sql.includes('DELETE FROM school_years'))years=years.filter(y=>y.id!==s.args[0]);
    if(s.sql.includes('SET is_active=CASE'))years.forEach(y=>y.is_active=y.id===s.args[0]?1:0);
  }
  return {db:{prepare,async batch(items){items.forEach(apply)}},years:()=>years,executed};
}
test('D1 years: create active year, delete other year, preserve remaining planning',async()=>{
  const f=api('functions/api/year-manage.js'),m=mockYearDB();
  const request=body=>({env:{DB:m.db},request:{json:async()=>body}});
  const add=await f(request({action:'create',label:'2026-2027'}));
  assert.equal(add.status,200);
  assert.equal(add.body.year.label,'2026-2027');
  assert.equal(m.years().find(y=>y.label==='2026-2027').is_active,1);
  const deleteOld=await f(request({action:'delete',year_id:'year-older'}));
  assert.equal(deleteOld.status,200);
  assert(!m.years().some(y=>y.id==='year-older'));
  assert.equal(m.years().find(y=>y.label==='2026-2027').is_active,1);
  assert(!m.executed.some(x=>/DELETE FROM evaluation_schedule_overrides/i.test(x.sql)));
});
