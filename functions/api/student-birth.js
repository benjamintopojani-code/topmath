export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return Response.json({ ok:false, error:'Binding DB absent' }, { status:500 });

    const body = await context.request.json().catch(() => null);
    const studentId = String(body?.student_id || '').trim();
    const birthDate = String(body?.birth_date || '').trim();

    if (!studentId) return Response.json({ ok:false, error:'Élève manquant' }, { status:400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return Response.json({ ok:false, error:'Date invalide' }, { status:400 });
    }

    const d = new Date(birthDate + 'T00:00:00Z');
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== birthDate) {
      return Response.json({ ok:false, error:'Date invalide' }, { status:400 });
    }

    const existing = await db.prepare('SELECT id FROM students WHERE id = ?').bind(studentId).first();
    if (!existing) return Response.json({ ok:false, error:'Élève introuvable' }, { status:404 });

    await db.prepare('UPDATE students SET birth_date = ? WHERE id = ?').bind(birthDate, studentId).run();
    return Response.json({ ok:true, student_id:studentId, birth_date:birthDate });
  } catch (error) {
    return Response.json({ ok:false, error:String(error?.message || error) }, { status:500 });
  }
}
