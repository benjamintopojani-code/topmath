function clean(v){return String(v??'').trim();}

export async function onRequestPost(context){
  try{
    const db=context.env.DB;
    if(!db) return Response.json({ok:false,error:'Binding DB absent'},{status:500});
    const body=await context.request.json().catch(()=>null);
    const classId=clean(body?.class_id);
    const ids=Array.isArray(body?.student_ids)?[...new Set(body.student_ids.map(clean).filter(Boolean))]:[];
    if(!classId) return Response.json({ok:false,error:'Classe de destination manquante'},{status:400});
    if(!ids.length) return Response.json({ok:false,error:'Aucun élève sélectionné'},{status:400});

    const year=await db.prepare(`SELECT id,label FROM school_years WHERE is_active=1 ORDER BY label DESC LIMIT 1`).first();
    if(!year) return Response.json({ok:false,error:'Aucune année scolaire active'},{status:400});
    const cls=await db.prepare(`SELECT id,name,phase FROM classes WHERE id=? AND school_year_id=?`).bind(classId,year.id).first();
    if(!cls) return Response.json({ok:false,error:'Classe de destination introuvable'},{status:404});

    const statements=ids.map(id=>db.prepare(`
      UPDATE enrollments
      SET class_id=?, phase=COALESCE(NULLIF(?,''),phase)
      WHERE school_year_id=? AND student_id=? AND class_id IS NULL
    `).bind(classId,clean(cls.phase),year.id,id));
    const results=await db.batch(statements);
    let changed=0;
    for(const r of results){ changed+=Number(r?.meta?.changes||0); }
    return Response.json({ok:true,assigned:changed,requested:ids.length,class_id:classId,class_name:cls.name,year:year.label});
  }catch(error){
    return Response.json({ok:false,error:String(error?.message||error)},{status:500});
  }
}
