import {jsonResponse} from '../_lib/auth.js';
import {generateUniqueCode} from './student-access-codes.js';

const clean = value => String(value ?? '').trim();
const fail = (error, status) => jsonResponse({ok:false,error}, status);

export async function onRequestGet({env}) {
  try {
    const {results: students} = await env.DB.prepare(`
      SELECT e.id AS enrollment_id, s.first_name, s.last_name, c.name AS class_name,
             e.class_id, e.archived_at, y.label AS school_year, y.is_active
      FROM enrollments e
      JOIN students s ON s.id=e.student_id
      JOIN school_years y ON y.id=e.school_year_id
      LEFT JOIN classes c ON c.id=e.class_id
      WHERE e.archived_at IS NOT NULL
      ORDER BY e.archived_at DESC, s.last_name, s.first_name
    `).all();
    return jsonResponse({ok:true,students});
  } catch (error) {
    console.error('Archives des élèves indisponibles', error);
    return fail('Les élèves archivés sont temporairement indisponibles.', 500);
  }
}

export async function onRequestPost({request,env}) {
  try {
    const db = env.DB;
    if (!db) return fail('Base D1 indisponible.', 503);
    const body = await request.json().catch(() => null);
    const action = clean(body?.action);
    if (!['remove-from-class','archive','restore'].includes(action)) return fail('Action invalide.', 400);

    const year = await db.prepare('SELECT id FROM school_years WHERE is_active=1 ORDER BY label DESC LIMIT 1').first();
    if (!year) return fail('Aucune année active.', 400);
    if (action === 'restore') return await restoreStudent(db, year.id, body);

    const studentId = clean(body.student_id);
    const row = await db.prepare(`
      SELECT id, class_id FROM enrollments
      WHERE student_id=? AND school_year_id=? AND archived_at IS NULL
    `).bind(studentId, year.id).first();
    if (!row) return fail('Élève introuvable dans l’année active.', 404);

    const archive = action === 'archive';
    if (archive && body.confirmation !== 'DOUBLE_CONFIRMATION_VALIDEE') return fail('Double confirmation requise.', 400);
    if (!archive && !row.class_id) return fail('Cet élève est déjà sans classe.', 409);

    const change = archive
      ? "UPDATE enrollments SET archived_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')"
      : 'UPDATE enrollments SET class_id=NULL';
    const [result] = await db.batch([
      db.prepare(change + ' WHERE id=? AND archived_at IS NULL').bind(row.id),
      db.prepare(`UPDATE students SET access_code=NULL WHERE id=? AND NOT EXISTS (
        SELECT 1 FROM enrollments e JOIN school_years y ON y.id=e.school_year_id
        WHERE e.student_id=? AND y.is_active=1 AND e.archived_at IS NULL AND e.class_id IS NOT NULL
      )`).bind(studentId, studentId)
    ]);
    if (result.meta.changes !== 1) return fail('Cette inscription a déjà été modifiée.', 409);
    return jsonResponse({ok:true,action,student_id:studentId});
  } catch (error) {
    console.error('Gestion des élèves impossible', error);
    return fail('L’opération n’a pas pu être terminée.', 500);
  }
}

async function restoreStudent(db, yearId, body) {
  const enrollmentId = clean(body.enrollment_id);
  const classId = clean(body.class_id);
  const target = await db.prepare(`
    SELECT e.student_id, c.phase
    FROM enrollments e JOIN classes c ON c.school_year_id=e.school_year_id
    WHERE e.id=? AND e.school_year_id=? AND e.archived_at IS NOT NULL AND c.id=?
  `).bind(enrollmentId, yearId, classId).first();
  if (!target) return fail('Choisis une classe de l’année active et une inscription archivée de cette année.', 409);

  const code = await generateUniqueCode(db);
  const [,result] = await db.batch([
    db.prepare(`UPDATE students SET access_code=COALESCE(access_code,?) WHERE id=? AND EXISTS (
      SELECT 1 FROM enrollments WHERE id=? AND archived_at IS NOT NULL
    )`).bind(code, target.student_id, enrollmentId),
    db.prepare(`UPDATE enrollments SET archived_at=NULL,class_id=?,phase=COALESCE(NULLIF(?,''),phase)
      WHERE id=? AND archived_at IS NOT NULL`).bind(classId, target.phase, enrollmentId)
  ]);
  if (result.meta.changes !== 1) return fail('Cette inscription a déjà été restaurée.', 409);
  return jsonResponse({ok:true,action:'restore'});
}
