function clean(v){ return String(v ?? '').trim(); }

export async function onRequestPost(context){
  try{
    const db=context.env.DB;
    if(!db) return Response.json({ok:false,error:'Binding DB absent'},{status:500});
    const body=await context.request.json().catch(()=>null);
    const action=clean(body?.action);
    const year=await db.prepare(`SELECT id,label FROM school_years WHERE is_active=1 ORDER BY created_at DESC, label DESC LIMIT 1`).first();
    if(!year) return Response.json({ok:false,error:'Aucune année scolaire active'},{status:400});

    if(action==='create'){
      const name=clean(body?.name);
      const phase=clean(body?.phase);
      const track=clean(body?.track).toUpperCase()==='ECO'?'ECO':'NORMAL';
      if(!name) return Response.json({ok:false,error:'Nom de classe manquant'},{status:400});
      const duplicate=await db.prepare(`SELECT id FROM classes WHERE school_year_id=? AND lower(name)=lower(?) LIMIT 1`).bind(year.id,name).first();
      if(duplicate) return Response.json({ok:false,error:'Une classe porte déjà ce nom'},{status:409});
      const id=crypto.randomUUID();
      await db.prepare(`INSERT INTO classes (id,school_year_id,name,track,phase) VALUES (?,?,?,?,?)`).bind(id,year.id,name,track,phase).run();
      return Response.json({ok:true,action:'create',class:{id,name,track,phase},year:year.label});
    }

    const classId=clean(body?.class_id);
    if(!classId) return Response.json({ok:false,error:'Classe manquante'},{status:400});
    const cls=await db.prepare(`SELECT id,name,track,phase FROM classes WHERE id=? AND school_year_id=?`).bind(classId,year.id).first();
    if(!cls) return Response.json({ok:false,error:'Classe introuvable dans l’année active'},{status:404});

    if(action==='rename'){
      const newName=clean(body?.name);
      if(!newName) return Response.json({ok:false,error:'Nouveau nom manquant'},{status:400});
      const duplicate=await db.prepare(`SELECT id FROM classes WHERE school_year_id=? AND lower(name)=lower(?) AND id<>? LIMIT 1`).bind(year.id,newName,classId).first();
      if(duplicate) return Response.json({ok:false,error:'Une classe porte déjà ce nom'},{status:409});
      await db.prepare(`UPDATE classes SET name=? WHERE id=? AND school_year_id=?`).bind(newName,classId,year.id).run();
      return Response.json({ok:true,action:'rename',class_id:classId,old_name:cls.name,new_name:newName,year:year.label});
    }

    if(action==='delete'){
      const countRow=await db.prepare(`SELECT COUNT(*) AS n FROM enrollments WHERE school_year_id=? AND class_id=?`).bind(year.id,classId).first();
      const students=Number(countRow?.n||0);
      const statements=[
        db.prepare(`UPDATE enrollments SET class_id=NULL WHERE school_year_id=? AND class_id=?`).bind(year.id,classId),
        db.prepare(`DELETE FROM class_schedule WHERE class_id=?`).bind(classId),
        db.prepare(`DELETE FROM calendar_exceptions WHERE school_year_id=? AND class_id=?`).bind(year.id,classId),
        db.prepare(`DELETE FROM classes WHERE id=? AND school_year_id=?`).bind(classId,year.id)
      ];
      await db.batch(statements);
      return Response.json({ok:true,action:'delete',class_id:classId,class_name:cls.name,unassigned_students:students,year:year.label});
    }

    return Response.json({ok:false,error:'Action non reconnue'},{status:400});
  }catch(error){
    return Response.json({ok:false,error:String(error?.message||error)},{status:500});
  }
}
