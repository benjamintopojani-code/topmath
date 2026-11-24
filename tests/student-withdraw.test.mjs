import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../functions/api/student-withdraw.js', import.meta.url), 'utf8');
const { onRequestPost } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const studentId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const token = 'a'.repeat(48);
function database() {
  const state = { enrolled:true, code:'TEST1234', evaluations:3 };
  return {
    state,
    prepare(sql) {
      return {
        sql,
        bind(...params) { this.params=params; return this; },
        async first() {
          if (sql.includes('FROM school_years')) return {id:'year-1',label:'2026-2027'};
          if (sql.includes('FROM students s')) return state.enrolled ? {id:studentId,first_name:'Test',last_name:'Élève'} : null;
          return null;
        }
      };
    },
    async batch(statements) {
      assert.match(statements[0].sql,/DELETE FROM enrollments/);
      assert.match(statements[1].sql,/SET access_code=NULL/);
      state.enrolled=false; state.code=null;
      return [{meta:{changes:1}},{meta:{changes:1}}];
    }
  };
}
async function send(db, access, body, enabled=true) {
  return onRequestPost({
    env:{DB:db,...(enabled?{TOPMATH_ADMIN_TOKEN:token}:{})},
    request:new Request('https://example.test/api/student-withdraw', {
      method:'POST',headers:access?{Authorization:'Bearer '+access}:{},
      body:JSON.stringify(body)
    })
  });
}
const payload={student_id:studentId,confirmation:'Test Élève',confirm_withdrawal:true};
const db=database();
assert.equal((await send(db,null,payload)).status,403);
assert.equal(db.state.enrolled,true);
assert.equal((await send(db,token,{...payload,confirmation:'Autre'})).status,409);
assert.equal(db.state.enrolled,true);
assert.equal((await send(db,token,{...payload,confirm_withdrawal:false})).status,400);
const result=await send(db,token,payload);
assert.equal(result.status,200);
assert.equal((await result.json()).history_preserved,true);
assert.equal(db.state.enrolled,false);
assert.equal(db.state.code,null);
assert.equal(db.state.evaluations,3);
assert.equal((await send(database(),token,payload,false)).status,503);
console.log('OK : accès, confirmation, retrait, historique et sécurité par défaut');
