
// Cloudflare Pages Function — /api/open-evaluation

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

// RÉCUPÉRER LES ÉVALUATIONS OUVERTES
export async function onRequestGet({ request, env }) {
  try {
    const db = env.DB;
    if (!db) return json({ ok: false, error: 'Connexion D1 indisponible.' }, 500);

    const url = new URL(request.url);
    const studentId = url.searchParams.get('student_id');
    const yearId = url.searchParams.get('school_year_id');

    if (!studentId && !yearId) {
      return json({ ok: false, error: 'Identifiant obligatoire.' }, 400);
    }

    let query = `
      SELECT oe.id, oe.school_year_id, oe.class_id,
             oe.student_id, oe.competency_id,
             oe.opened_at, oe.closed_at,
             c.code AS competency_code
      FROM open_evaluations oe
      LEFT JOIN competencies c ON c.id = oe.competency_id
      WHERE oe.closed_at IS NULL
    `;

    const params = [];

    if (studentId) {
      query += ' AND oe.student_id = ?';
      params.push(studentId);
    }

    if (yearId) {
      query += ' AND oe.school_year_id = ?';
      params.push(yearId);
    }

    query += ' ORDER BY oe.opened_at DESC';

    const { results = [] } = await db.prepare(query).bind(...params).all();

    return json({ ok: true, evaluations: results });

  } catch (error) {
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}

// OUVRIR OU FERMER UNE ÉVALUATION
export async function onRequestPost({ request, env }) {
  try {
    const db = env.DB;
    if (!db) return json({ ok: false, error: 'Connexion D1 indisponible.' }, 500);

    const body = await request.json();
    const { action, school_year_id, class_id } = body || {};

    if (!school_year_id || !class_id) {
      return json({ ok: false, error: 'Année scolaire et classe obligatoires.' }, 400);
    }

    if (action === 'open') {
      const competency_id = body.competency_id;
      const studentIds = Array.isArray(body.student_ids)
        ? [...new Set(body.student_ids.map(String).filter(Boolean))]
        : [];

      if (!competency_id || !studentIds.length) {
        return json({ ok: false, error: 'Compétence et élèves obligatoires.' }, 400);
      }

      const year = await db.prepare(
        'SELECT id FROM school_years WHERE id = ? AND is_active = 1'
      ).bind(school_year_id).first();

      if (!year) {
        return json({ ok: false, error: 'Année scolaire inactive ou introuvable.' }, 404);
      }

      const cls = await db.prepare(
        'SELECT id FROM classes WHERE id = ? AND school_year_id = ?'
      ).bind(class_id, school_year_id).first();

      if (!cls) {
        return json({ ok: false, error: 'Classe introuvable.' }, 404);
      }

      const competency = await db.prepare(
        'SELECT id FROM competencies WHERE id = ?'
      ).bind(competency_id).first();

      if (!competency) {
        return json({ ok: false, error: 'Compétence introuvable.' }, 404);
      }

      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT INTO open_evaluations
        (id, school_year_id, class_id, student_id,
         competency_id, opened_at, closed_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL)
      `);

      const statements = [];

      for (const studentId of studentIds) {
        const existing = await db.prepare(`
          SELECT id FROM open_evaluations
          WHERE school_year_id = ?
          AND class_id = ?
          AND student_id = ?
          AND competency_id = ?
          AND closed_at IS NULL
          LIMIT 1
        `).bind(
          school_year_id, class_id, studentId, competency_id
        ).first();

        if (!existing) {
          statements.push(
            insert.bind(
              crypto.randomUUID(),
              school_year_id,
              class_id,
              studentId,
              competency_id,
              now
            )
          );
        }
      }

      if (statements.length) {
        await db.batch(statements);
      }

      return json({
        ok: true,
        opened: studentIds.length,
        created: statements.length
      });
    }

    if (action === 'close') {
      const studentId = body.student_id || null;

      let query = `
        UPDATE open_evaluations
        SET closed_at = ?
        WHERE school_year_id = ?
        AND class_id = ?
        AND closed_at IS NULL
      `;

      const params = [
        new Date().toISOString(),
        school_year_id,
        class_id
      ];

      if (studentId) {
        query += ' AND student_id = ?';
        params.push(studentId);
      }

      const result = await db.prepare(query).bind(...params).run();

      return json({
        ok: true,
        closed: Number(result.meta?.changes || 0)
      });
    }

    return json({ ok: false, error: 'Action inconnue.' }, 400);

  } catch (error) {
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
