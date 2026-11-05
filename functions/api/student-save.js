function validIsoDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) return Response.json({ ok:false, error:'Binding DB absent' }, { status:500 });
    const body = await context.request.json().catch(() => null);
    const studentId = String(body?.student_id || '').trim();
    const firstName = String(body?.first_name || '').trim();
    const lastName = String(body?.last_name || '').trim();
    const birthDate = String(body?.birth_date || '').trim();
    const classId = String(body?.class_id || '').trim();
    const phase = String(body?.phase || '').trim();
    const sector = String(body?.sector || '').trim();
    const professionalGroup = String(body?.professional_group || '').trim();
    const job = String(body?.job || '').trim();
    if (!firstName || !lastName || !classId) return Response.json({ok:false,error:'Prénom, nom et classe sont obligatoires'}, {status:400});
    if (!validIsoDate(birthDate)) return Response.json({ok:false,error:'Date de naissance invalide'}, {status:400});

    const schoolYear = await db.prepare(`SELECT id FROM school_years WHERE is_active=1 ORDER BY label DESC LIMIT 1`).first();
    if (!schoolYear) return Response.json({ok:false,error:'Aucune année scolaire active'}, {status:400});
    const cls = await db.prepare(`SELECT id, track, phase FROM classes WHERE id=? AND school_year_id=?`).bind(classId, schoolYear.id).first();
    if (!cls) return Response.json({ok:false,error:'Classe introuvable dans l’année active'}, {status:404});

    let id = studentId;
    if (id) {
      const existing = await db.prepare(`SELECT id FROM students WHERE id=?`).bind(id).first();
      if (!existing) return Response.json({ok:false,error:'Élève introuvable'}, {status:404});
      await db.prepare(`UPDATE students SET first_name=?, last_name=?, birth_date=? WHERE id=?`)
        .bind(firstName, lastName, birthDate || null, id).run();
      const enrollment = await db.prepare(`SELECT id FROM enrollments WHERE student_id=? AND school_year_id=? LIMIT 1`).bind(id, schoolYear.id).first();
      if (enrollment) {
        await db.prepare(`UPDATE enrollments SET class_id=?, phase=?, sector=?, professional_group=?, job=? WHERE id=?`)
          .bind(classId, phase || cls.phase || '', sector || null, professionalGroup || null, job || null, enrollment.id).run();
      } else {
        await db.prepare(`INSERT INTO enrollments (id,student_id,class_id,school_year_id,phase,sector,professional_group,job) VALUES (?,?,?,?,?,?,?,?)`)
          .bind(crypto.randomUUID(), id, classId, schoolYear.id, phase || cls.phase || '', sector || null, professionalGroup || null, job || null).run();
      }
    } else {
      id = crypto.randomUUID();
      await db.batch([
        db.prepare(`INSERT INTO students (id,last_name,first_name,birth_date,access_code) VALUES (?,?,?,?,NULL)`).bind(id,lastName,firstName,birthDate||null),
        db.prepare(`INSERT INTO enrollments (id,student_id,class_id,school_year_id,phase,sector,professional_group,job) VALUES (?,?,?,?,?,?,?,?)`)
          .bind(crypto.randomUUID(), id, classId, schoolYear.id, phase || cls.phase || '', sector || null, professionalGroup || null, job || null)
      ]);
    }
    return Response.json({ok:true, student_id:id});
  } catch (error) {
    return Response.json({ok:false,error:String(error?.message||error)}, {status:500});
  }
}
