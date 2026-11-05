export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB
      .prepare(`
        SELECT
          s.first_name,
          s.last_name,
          c.name AS class_name,
          c.track,
          e.phase,
          e.professional_group,
          e.job
        FROM enrollments e
        JOIN students s ON s.id = e.student_id
        JOIN classes c ON c.id = e.class_id
        ORDER BY s.last_name, s.first_name
      `)
      .all();

    return new Response(JSON.stringify({
      ok: true,
      source: 'Cloudflare D1',
      students: results
    }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
}
