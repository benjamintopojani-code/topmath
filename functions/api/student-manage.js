import {jsonResponse} from '../_lib/auth.js';

const clean=value=>String(value??'').trim();

export async function onRequestPost({request,env}){
  try{
    const db=env.DB;
    if(!db)return jsonResponse({ok:false,error:'Base D1 indisponible.'},503);
    const body=await request.json().catch(()=>null);
    const action=clean(body?.action),studentId=clean(body?.student_id);
    if(!['remove-from-class','delete-permanently'].includes(action)||!studentId)return jsonResponse({ok:false,error:'Action ou élève invalide.'},400);

    const year=await db.prepare('SELECT id FROM school_years WHERE is_active=1 LIMIT 1').first();
    if(!year)return jsonResponse({ok:false,error:'Aucune année active.'},400);
    const row=await db.prepare('SELECT s.id,s.first_name,s.last_name,e.id AS enrollment_id,e.class_id FROM students s JOIN enrollments e ON e.student_id=s.id WHERE s.id=? AND e.school_year_id=? LIMIT 1').bind(studentId,year.id).first();
    if(!row)return jsonResponse({ok:false,error:'Élève introuvable dans l’année active.'},404);

    if(action==='remove-from-class'){
      if(!row.class_id)return jsonResponse({ok:false,error:'Cet élève est déjà sans classe.'},409);
      // Conserver l'inscription et ses évaluations. Révoquer le code : l'espace personnel
      // ne doit plus être accessible tant que l'élève n'est pas réaffecté.
      await db.batch([
        db.prepare('UPDATE enrollments SET class_id=NULL WHERE id=?').bind(row.enrollment_id),
        db.prepare('UPDATE students SET access_code=NULL WHERE id=?').bind(studentId)
      ]);
      return jsonResponse({ok:true,action,student_id:studentId,access_revoked:true});
    }
    if(clean(body?.confirmation)!=='DOUBLE_CONFIRMATION_VALIDEE')return jsonResponse({ok:false,error:'Confirmation définitive requise.'},400);

    // Toutes les années et les évaluations connues sont concernées.
    // D1 batch est transactionnel : un échec de contrainte annule toute la suppression.
    await db.batch([
      db.prepare('DELETE FROM official_evaluations WHERE student_id=?').bind(studentId),
      db.prepare('DELETE FROM evaluation_schedule_overrides WHERE student_id=?').bind(studentId),
      db.prepare('DELETE FROM enrollments WHERE student_id=?').bind(studentId),
      db.prepare('DELETE FROM students WHERE id=?').bind(studentId)
    ]);
    return jsonResponse({ok:true,action,student_id:studentId});
  }catch(error){
    console.error('Gestion de suppression élève impossible',error);
    return jsonResponse({ok:false,error:'Opération impossible. Aucune suppression ne doit être considérée comme confirmée. Vérifie les données liées à cet élève.'},500);
  }
}
