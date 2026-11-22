
export async function onRequestPost(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return Response.json(
        { ok: false, error: "Base D1 indisponible." },
        { status: 500 }
      );
    }

    const body = await context.request.json().catch(() => null);
    const code = String(body?.code ?? "").trim().toUpperCase();

    if (!/^[A-Z0-9]{4,16}$/.test(code)) {
      return Response.json(
        { ok: false, error: "Code personnel invalide." },
        { status: 400 }
      );
    }

    const student = await db.prepare(`
      SELECT
        s.id,
        s.first_name,
        s.last_name,
        c.name AS class_name,
        sy.label AS school_year
      FROM students s
      JOIN enrollments e ON e.student_id = s.id
      JOIN school_years sy ON sy.id = e.school_year_id
      LEFT JOIN classes c ON c.id = e.class_id
      WHERE s.access_code = ?
        AND sy.is_active = 1
      LIMIT 1
    `).bind(code).first();

    if (!student) {
      return Response.json(
        {
          ok: false,
          error: "Code inconnu ou élève non inscrit dans l'année active."
        },
        { status: 401 }
      );
    }

    return Response.json({
      ok: true,
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        class_name: student.class_name,
        school_year: student.school_year
      }
    });

  } catch (error) {
    console.error("Erreur de connexion élève", error);

    return Response.json(
      { ok: false, error: "Erreur lors de la connexion." },
      { status: 500 }
    );
  }
}
