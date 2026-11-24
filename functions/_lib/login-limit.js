// Limitation des échecs de connexion, commune aux instances Cloudflare Pages.
// Les identifiants stockés sont des HMAC ; ni IP ni code élève en clair dans D1.
const WINDOW_SECONDS=15*60;
const LIMITS={teacher:8,student_ip:120,student_code:5};
const encoder=new TextEncoder();

async function keyFor(env,scope,ip,code=''){
  const secret=String(env.TOPMATH_SESSION_SECRET||'');
  if(secret.length<32)throw new Error('AUTH_CONFIG_MISSING');
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode([scope,ip,code].join('\u0000')));
  return Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('');
}
async function ensureTable(db){
  await db.prepare('CREATE TABLE IF NOT EXISTS auth_failed_attempts (scope TEXT NOT NULL, identifier TEXT NOT NULL, window_start INTEGER NOT NULL, failures INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (scope, identifier))').run();
}
export async function checkLoginLimit(env,request,type,code=''){
  if(!env.DB)throw new Error('AUTH_DB_MISSING');
  await ensureTable(env.DB);
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const scopes=type==='teacher'?[['teacher','']]:[['student_ip',''],['student_code',code]];
  const now=Math.floor(Date.now()/1000);
  const buckets=[];
  for(const [scope,value] of scopes){
    const identifier=await keyFor(env,scope,ip,value);
    const row=await env.DB.prepare('SELECT window_start, failures FROM auth_failed_attempts WHERE scope=? AND identifier=?').bind(scope,identifier).first();
    if(row&&row.window_start>now-WINDOW_SECONDS&&row.failures>=LIMITS[scope]){
      return {blocked:true,retryAfter:Math.max(1,row.window_start+WINDOW_SECONDS-now)};
    }
    buckets.push({scope,identifier});
  }
  return {blocked:false,buckets};
}
export async function recordLoginFailure(env,buckets){
  const now=Math.floor(Date.now()/1000),cutoff=now-WINDOW_SECONDS;
  for(const {scope,identifier} of buckets){
    await env.DB.prepare('INSERT INTO auth_failed_attempts (scope,identifier,window_start,failures) VALUES (?,?,?,1) ON CONFLICT(scope,identifier) DO UPDATE SET window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END, failures=CASE WHEN window_start<=? THEN 1 ELSE failures+1 END').bind(scope,identifier,now,cutoff,cutoff).run();
  }
}
export async function clearSuccessfulLogin(env,buckets){
  // Un succès réinitialise seulement le compteur ciblé, et non le quota IP
  // des élèves (qui protège contre les essais de nombreux codes différents).
  for(const {scope,identifier} of buckets.filter(x=>x.scope==='teacher'||x.scope==='student_code')){
    await env.DB.prepare('DELETE FROM auth_failed_attempts WHERE scope=? AND identifier=?').bind(scope,identifier).run();
  }
}
export function limitedResponse(jsonResponse,retryAfter){
  return jsonResponse({ok:false,error:'Trop de tentatives de connexion. Réessaie dans quelques minutes.'},429,{'Retry-After':String(retryAfter)});
}
