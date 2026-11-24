import {createSessionCookie,jsonResponse} from '../_lib/auth.js';
import {checkLoginLimit,recordLoginFailure,clearSuccessfulLogin,limitedResponse} from '../_lib/login-limit.js';
export async function onRequestPost(context){
  try{
    const db=context.env.DB;
    if(!db)return jsonResponse({ok:false,error:'Base D1 indisponible.'},500);
    const body=await context.request.json().catch(()=>null);
    const code=String(body?.code??'').trim().toUpperCase();
    if(!/^[A-Z0-9]{8}$/.test(code))return jsonResponse({ok:false,error:'Le code personnel doit contenir 8 lettres ou chiffres.'},400);
    const limit=await checkLoginLimit(context.env,context.request,'student',code);
    if(limit.blocked)return limitedResponse(jsonResponse,limit.retryAfter);
    const {results=[]}=await db.prepare('SELECT s.id,s.first_name,s.last_name,c.name AS class_name,e.phase,sy.label AS school_year FROM students s JOIN enrollments e ON e.student_id=s.id JOIN school_years sy ON sy.id=e.school_year_id LEFT JOIN classes c ON c.id=e.class_id WHERE s.access_code=? AND sy.is_active=1 AND e.archived_at IS NULL LIMIT 2').bind(code).all();
    if(results.length!==1){
      await recordLoginFailure(context.env,limit.buckets);
      return jsonResponse({ok:false,error:'Code personnel incorrect.'},401);
    }
    const s=results[0];
    const cookie=await createSessionCookie(context.env,s.id,'student');
    await clearSuccessfulLogin(context.env,limit.buckets);
    return jsonResponse({ok:true,student:{id:s.id,first_name:s.first_name,last_name:s.last_name,class_name:s.class_name,phase:s.phase,school_year:s.school_year}},200,{'Set-Cookie':cookie});
  }catch(error){
    if(String(error?.message||error)==='AUTH_CONFIG_MISSING')return jsonResponse({ok:false,error:'Connexion sécurisée non configurée sur le serveur.'},503);
    console.error('Erreur de connexion élève',error);
    return jsonResponse({ok:false,error:'Erreur lors de la connexion.'},500);
  }
}
