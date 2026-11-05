export async function onRequestGet(context) {
  try {
    const year = await context.env.DB.prepare(`
      SELECT id, label
      FROM school_years
      WHERE is_active = 1
      ORDER BY label DESC
      LIMIT 1
    `).first();

    if (!year) {
      return Response.json({ ok: true, source: 'Cloudflare D1', year: null, classes: [], students: [] });
    }

    const { results: classes } = await context.env.DB.prepare(`
      SELECT id, name, track, phase
      FROM classes
      WHERE school_year_id = ?
      ORDER BY name
    `).bind(year.id).all();

    const { results: students } = await context.env.DB.prepare(`
      SELECT
        s.id AS student_id,
        s.first_name,
        s.last_name,
        s.birth_date,
        c.id AS class_id,
        c.name AS class_name,
        c.track,
        e.phase,
        e.sector,
        e.professional_group,
        e.job
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      LEFT JOIN classes c ON c.id = e.class_id
      WHERE e.school_year_id = ?
      ORDER BY c.name, s.last_name, s.first_name
    `).bind(year.id).all();

    return Response.json({
      ok: true,
      source: 'Cloudflare D1',
      year: { id: year.id, label: year.label },
      classes,
      students
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
