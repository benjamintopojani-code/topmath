import { verifyTeacherAccess } from './_access-auth.js';

function fail(message, status) {
  return Response.json({ok:false,error:message}, {status,headers:{'Cache-Control':'no-store'}});
}
export async function onRequestPost(context) {
  const auth = await verifyTeacherAccess(context.request, context.env);
  if (!auth.ok) return fail(auth.error, auth.status);
  try {
    const db = context.env?.DB;
    if (!db) return fail('Base D1 indisponible.', 500);
    const origin = context.request.headers.get('Origin');
    if (origin && origin !== new URL(context.request.url).origin) return fail('Origine de la requête refusée.', 403);
    const body = await context.request.json().catch(() => null);
    const studentId = String(body?.student_id || '').trim();
    const confirmation = String(body?.confirmation || '').trim();
    if (!/^[a-f0-9-]{36}$/i.test(studentId) || !confirmation) return fail('Identifiant ou confirmation manquant.', 400);
    if (body?.confirm_withdrawal !== true) return fail('Confirmation explicite obligatoire.', 400);

    const year = await db.prepare('SELECT id,label FROM school_years WHERE is_active=1 ORDER BY label DESC LIMIT 1').first();
    if (!year) return fail('Aucune année scolaire active.', 400);
    const pupil = await db.prepare(`
      SELECT s.id,s.first_name,s.last_name
      FROM students s JOIN enrollments e ON e.student_id=s.id
      WHERE s.id=? AND e.school_year_id=? LIMIT 1
    `).bind(studentId, year.id).first();
    if (!pupil) return fail('Élève non inscrit dans l’année active.', 404);
    const fullName = `${pupil.first_name} ${pupil.last_name}`.replace(/\s+/g,' ').trim();
    if (confirmation !== fullName) return fail('Le nom de confirmation ne correspond pas.', 409);

    // Conserver la fiche, les évaluations et l'historique des années précédentes.
    const results = await db.batch([
      db.prepare('DELETE FROM enrollments WHERE student_id=? AND school_year_id=?').bind(studentId, year.id),
      db.prepare(`UPDATE students SET access_code=NULL WHERE id=? AND NOT EXISTS (
        SELECT 1 FROM enrollments e JOIN school_years y ON y.id=e.school_year_id
        WHERE e.student_id=? AND y.is_active=1
      )`).bind(studentId, studentId)
    ]);
    if (Number(results?.[0]?.meta?.changes || 0) !== 1) return fail('Retrait non confirmé : vérifier les inscriptions.', 409);
    return Response.json({ok:true,action:'withdraw',student_id:studentId,student_name:fullName,school_year:year.label,history_preserved:true}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('student-withdraw failed', error);
    return fail('Le retrait n’a pas pu être réalisé.', 500);
  }
}
