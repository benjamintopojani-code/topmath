// Retrait d'un élève de l'année scolaire active.
// Route volontairement inactive sans TOPMATH_ADMIN_TOKEN défini côté serveur.
function secureEqual(a, b) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) difference |= (left[i] || 0) ^ (right[i] || 0);
  return difference === 0;
}

function fail(message, status) {
  return Response.json({ ok: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPost(context) {
  try {
    const expected = String(context.env?.TOPMATH_ADMIN_TOKEN || '');
    if (expected.length < 32) return fail('Suppression non activée : accès administrateur non configuré.', 503);
    const authorization = context.request.headers.get('Authorization') || '';
    const match = /^Bearer ([A-Za-z0-9_\-.~+/=]{32,512})$/.exec(authorization);
    if (!match || !secureEqual(match[1], expected)) return fail('Accès refusé.', 403);

    const db = context.env?.DB;
    if (!db) return fail('Base D1 indisponible.', 500);
    const body = await context.request.json().catch(() => null);
    const studentId = String(body?.student_id || '').trim();
    const confirmation = String(body?.confirmation || '').trim();
    if (!/^[a-f0-9-]{36}$/i.test(studentId) || !confirmation) return fail('Identifiant ou confirmation manquant.', 400);
    if (body?.confirm_withdrawal !== true) return fail('Confirmation explicite obligatoire.', 400);

    const year = await db.prepare('SELECT id, label FROM school_years WHERE is_active=1 ORDER BY label DESC LIMIT 1').first();
    if (!year) return fail('Aucune année scolaire active.', 400);
    const pupil = await db.prepare(`
      SELECT s.id, s.first_name, s.last_name
      FROM students s
      JOIN enrollments e ON e.student_id = s.id
      WHERE s.id=? AND e.school_year_id=? LIMIT 1
    `).bind(studentId, year.id).first();
    if (!pupil) return fail('Élève non inscrit dans l’année active.', 404);
    const fullName = `${pupil.first_name} ${pupil.last_name}`.replace(/\s+/g, ' ').trim();
    if (confirmation !== fullName) return fail('Le nom de confirmation ne correspond pas.', 409);

    // Ne supprimer ni l'élève ni ses évaluations : uniquement l'inscription active.
    // L'UPDATE supprime le code seulement si aucune inscription active ne subsiste.
    const results = await db.batch([
      db.prepare('DELETE FROM enrollments WHERE student_id=? AND school_year_id=?').bind(studentId, year.id),
      db.prepare(`UPDATE students SET access_code=NULL WHERE id=? AND NOT EXISTS (
        SELECT 1 FROM enrollments e JOIN school_years y ON y.id=e.school_year_id
        WHERE e.student_id=? AND y.is_active=1
      )`).bind(studentId, studentId)
    ]);
    if (Number(results?.[0]?.meta?.changes || 0) !== 1) return fail('Retrait non confirmé : vérifier les inscriptions.', 409);
    return Response.json({ok:true,action:'withdraw',student_id:studentId,student_name:fullName,school_year:year.label,history_preserved:true,access_revoked:Number(results?.[1]?.meta?.changes||0)>0}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('student-withdraw failed', error);
    return fail('Le retrait n’a pas pu être réalisé.', 500);
  }
}
