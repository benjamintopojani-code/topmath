import {createSessionCookie,verifyTeacherPassword,jsonResponse} from '../../_lib/auth.js';
import {checkLoginLimit,recordLoginFailure,clearSuccessfulLogin,limitedResponse} from '../../_lib/login-limit.js';
export async function onRequestPost({request,env}){
  try{
    const hash=String(env.TOPMATH_TEACHER_PASSWORD_HASH||'');
    if(!hash)return jsonResponse({ok:false,error:'Connexion enseignant non configurée sur le serveur.'},503);
    const body=await request.json().catch(()=>null),password=String(body?.password||'');
    if(!password||password.length>1024)return jsonResponse({ok:false,error:'Mot de passe incorrect.'},401);
    const limit=await checkLoginLimit(env,request,'teacher');
    if(limit.blocked)return limitedResponse(jsonResponse,limit.retryAfter);
    if(!(await verifyTeacherPassword(password,hash))){
      await recordLoginFailure(env,limit.buckets);
      return jsonResponse({ok:false,error:'Mot de passe incorrect.'},401);
    }
    const cookie=await createSessionCookie(env,'teacher','teacher');
    await clearSuccessfulLogin(env,limit.buckets);
    return jsonResponse({ok:true,role:'teacher'},200,{'Set-Cookie':cookie});
  }catch(error){
    if(String(error?.message||error)==='AUTH_CONFIG_MISSING')return jsonResponse({ok:false,error:'Authentification serveur non configurée.'},503);
    console.error('[TopMath] teacher-login internal failure',{name:error?.name||'Error',message:String(error?.message||error)});
    return jsonResponse({ok:false,error:'Connexion impossible.'},500);
  }
}
