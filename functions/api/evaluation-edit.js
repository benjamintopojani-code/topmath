function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return Response.json({ ok: false, error: 'Binding DB absent' }, { status: 500 });

    const body = await context.request.json().catch(() => null);
    const studentId = String(body?.student_id || '').trim();
    const competencyCode = String(body?.competency_code || '').trim().toUpperCase();
    const dates = Array.isArray(body?.dates) ? body.dates.slice(0, 3).map(v => String(v || '').trim()) : [];

    if (!studentId || !competencyCode || dates.length !== 3) {
      return Response.json({ ok: false, error: 'Données incomplètes' }, { status: 400 });
    }
    for (const value of dates) {
      if (value && !validIsoDate(value)) {
        return Response.json({ ok: false, error: 'Une date est invalide' }, { status: 400 });
      }
    }

    const enrollment = await db.prepare(`
      SELECT e.school_year_id, e.phase, c.track
      FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      JOIN school_years sy ON sy.id = e.school_year_id
      WHERE e.student_id = ? AND sy.is_active = 1
      LIMIT 1
    `).bind(studentId).first();
    if (!enrollment) return Response.json({ ok: false, error: 'Élève non inscrit dans l’année active' }, { status: 404 });

    const phaseNum = Number(String(enrollment.phase || '').match(/\d+/)?.[0] || 0);
    const competency = await db.prepare(`
      SELECT id, code, track, phase
      FROM competencies
      WHERE code = ? AND track = ? AND phase = ?
      LIMIT 1
    `).bind(competencyCode, enrollment.track, phaseNum).first();
    if (!competency) {
      return Response.json({ ok: false, error: `Compétence ${competencyCode} introuvable pour ${enrollment.track} phase ${phaseNum}` }, { status: 404 });
    }

    const statements = [];
    for (let i = 0; i < 3; i++) {
      const pass = i + 1;
      const value = dates[i];
      const existing = await db.prepare(`
        SELECT id, evaluation_date, is_cancelled
        FROM official_evaluations
        WHERE student_id = ? AND competency_id = ? AND school_year_id = ? AND evaluation_no = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(studentId, competency.id, enrollment.school_year_id, pass).first();

      if (value) {
        if (existing) {
          statements.push(db.prepare(`
            UPDATE official_evaluations
            SET evaluation_date = ?, is_cancelled = 0, cancelled_at = NULL
            WHERE id = ?
          `).bind(value, existing.id));
        } else {
          statements.push(db.prepare(`
            INSERT INTO official_evaluations
              (id, student_id, competency_id, school_year_id, evaluation_no, evaluation_date, is_cancelled)
            VALUES (?, ?, ?, ?, ?, ?, 0)
          `).bind(crypto.randomUUID(), studentId, competency.id, enrollment.school_year_id, pass, value));
        }
      } else if (existing && !Number(existing.is_cancelled)) {
        statements.push(db.prepare(`
          UPDATE official_evaluations
          SET is_cancelled = 1, cancelled_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(existing.id));
      }
    }

    if (statements.length) await db.batch(statements);

    const { results } = await db.prepare(`
      SELECT evaluation_no, evaluation_date, is_cancelled, cancelled_at
      FROM official_evaluations
      WHERE student_id = ? AND competency_id = ? AND school_year_id = ?
      ORDER BY evaluation_no
    `).bind(studentId, competency.id, enrollment.school_year_id).all();

    return Response.json({
      ok: true,
      student_id: studentId,
      competency_code: competencyCode,
      evaluations: results || []
    });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
