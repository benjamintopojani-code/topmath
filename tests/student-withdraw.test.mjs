import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { verifyTeacherAccess } from '../functions/api/_access-auth.js';
import { onRequestPost } from '../functions/api/student-withdraw.js';
import { onRequestGet } from '../functions/api/student-withdraw-list.js';
globalThis.crypto ||= webcrypto;
const issuer='https://topmath-tests.cloudflareaccess.com';
const env={TOPMATH_ACCESS_TEAM_DOMAIN:issuer,TOPMATH_ACCESS_AUD:'topmath-admin',TOPMATH_ACCESS_EMAILS:'teacher@example.test'};
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey);Object.assign(publicKey,{kid:'topmath-test-kid',alg:'RS256',use:'sig'});
globalThis.fetch=async url=>{assert.equal(url,issuer+'/cdn-cgi/access/certs');return Response.json({keys:[publicKey]});};
const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
async function token(options={}) {
 const now=Math.floor(Date.now()/1000);
 const claims={iss:issuer,aud:['topmath-admin'],email:'teacher@example.test',iat:now,exp:now+3600,...options};
 const first=b64({alg:'RS256',kid:'topmath-test-kid',typ:'JWT'})+'.'+b64(claims);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(first));
 return first+'.'+Buffer.from(signature).toString('base64url');
}
const jwt=await token();
function request(path='/api/student-withdraw',jwtValue=jwt,body={}) {
 return new Request('https://topmath.example.test'+path,{method:path.includes('list')?'GET':'POST',headers:{...(jwtValue?{'Cf-Access-Jwt-Assertion':jwtValue}:{}),'content-type':'application/json'},...(path.includes('list')?{}:{body:JSON.stringify(body)})});
}
assert.equal((await verifyTeacherAccess(request('/api/student-withdraw',jwt),env)).ok,true);
assert.equal((await verifyTeacherAccess(request('/api/student-withdraw',null),env)).ok,false);
assert.equal((await verifyTeacherAccess(request('/api/student-withdraw',await token({email:'other@example.test'})),env)).ok,false);
assert.equal((await verifyTeacherAccess(request('/api/student-withdraw',await token({exp:1})),env)).ok,false);
assert.equal((await verifyTeacherAccess(request('/api/student-withdraw',await token({aud:['wrong']})),env)).ok,false);
assert.equal((await verifyTeacherAccess(request('/api/student-withdraw',jwt+'broken'),env)).ok,false);
assert.equal((await verifyTeacherAccess(request('/api/student-withdraw',jwt),{})).status,503);
const studentId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const state={enrolled:true,accessCode:'ABCD1234',evaluations:3};
const db={
 prepare(sql){return {sql,bind(...params){this.params=params;return this;},async first(){
   if(sql.includes('FROM school_years'))return {id:'year-1',label:'2026-2027'};
   if(sql.includes('FROM students s'))return state.enrolled?{id:studentId,first_name:'Test',last_name:'Élève'}:null;
   return null;
 },async all(){return {results:state.enrolled?[{student_id:studentId,first_name:'Test',last_name:'Élève',class_name:'P1'}]:[]}}};},
 async batch(statements){assert.match(statements[0].sql,/DELETE FROM enrollments/);assert.match(statements[1].sql,/SET access_code=NULL/);state.enrolled=false;state.accessCode=null;return [{meta:{changes:1}},{meta:{changes:1}}];}
};
const payload={student_id:studentId,confirmation:'Test Élève',confirm_withdrawal:true};
const context=(req,extra={})=>({request:req,env:{...env,DB:db,...extra}});
assert.equal((await onRequestGet(context(request('/api/student-withdraw-list',null)))).status,403);
const listResponse=await onRequestGet(context(request('/api/student-withdraw-list')));
assert.equal((await listResponse.json()).students.length,1);
assert.equal((await onRequestPost(context(request('/api/student-withdraw',jwt,{...payload,confirmation:'Autre'})))).status,409);
assert.equal(state.enrolled,true);
assert.equal((await onRequestPost(context(request('/api/student-withdraw',jwt,{...payload,confirm_withdrawal:false})))).status,400);
assert.equal((await onRequestPost(context(request('/api/student-withdraw',null,payload)))).status,403);
const response=await onRequestPost(context(request('/api/student-withdraw',jwt,payload)));
assert.equal(response.status,200);
assert.equal((await response.json()).history_preserved,true);
assert.equal(state.enrolled,false);
assert.equal(state.accessCode,null);
assert.equal(state.evaluations,3);
console.log('OK : JWT signé, liste privée, confirmation, retrait, conservation et refus par défaut');
