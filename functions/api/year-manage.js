function clean(v){ return String(v ?? '').trim(); }
function validBaseLabel(v){ return /^\d{4}-\d{4}$/.test(clean(v)); }
async function uniqueYearLabel(db, base){
  const {results=[]}=await db.prepare(`SELECT label FROM school_years WHERE label=? OR label LIKE ?`).bind(base, base+' (%)').all();
  const used=new Set(results.map(r=>String(r.label||'')));
  if(!used.has(base)) return base;
  let n=1;
  while(used.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

export async function onRequestPost(context){
  try{
    const db=context.env.DB;
    if(!db) return Response.json({ok:false,error:'Binding DB absent'},{status:500});
    const body=await context.request.json().catch(()=>null);
    const action=clean(body?.action);

    if(action==='create'){
      const baseLabel=clean(body?.label);
      if(!validBaseLabel(baseLabel)) return Response.json({ok:false,error:'Utilise le format 2027-2028'},{status:400});
      const label=await uniqueYearLabel(db,baseLabel);
      const id=crypto.randomUUID();
      await db.batch([
        db.prepare(`UPDATE school_years SET is_active=0 WHERE is_active=1`),
        db.prepare(`INSERT INTO school_years (id,label,is_active) VALUES (?,?,1)`).bind(id,label)
      ]);
      return Response.json({ok:true,action:'create',year:{id,label,is_active:1},base_label:baseLabel});
    }

    const yearId=clean(body?.year_id);
    if(action!=='delete') return Response.json({ok:false,error:'Action non reconnue'},{status:400});
    if(!yearId) return Response.json({ok:false,error:'Année manquante'},{status:400});

    const year=await db.prepare(`SELECT id,label,is_active FROM school_years WHERE id=?`).bind(yearId).first();
    if(!year) return Response.json({ok:false,error:'Année introuvable'},{status:404});

    const {results: classRows}=await db.prepare(`SELECT id FROM classes WHERE school_year_id=?`).bind(yearId).all();
    const classIds=(classRows||[]).map(r=>r.id);
    const {results: studentRows}=await db.prepare(`SELECT DISTINCT student_id FROM enrollments WHERE school_year_id=?`).bind(yearId).all();
    const studentIds=(studentRows||[]).map(r=>r.student_id);

    const statements=[];
    statements.push(db.prepare(`DELETE FROM official_evaluations WHERE school_year_id=?`).bind(yearId));
    statements.push(db.prepare(`DELETE FROM calendar_exceptions WHERE school_year_id=?`).bind(yearId));
    if(classIds.length){
      const ph=classIds.map(()=>'?').join(',');
      statements.push(db.prepare(`DELETE FROM class_schedule WHERE class_id IN (${ph})`).bind(...classIds));
    }
    if(studentIds.length){
      const ph=studentIds.map(()=>'?').join(',');
      statements.push(db.prepare(`DELETE FROM evaluation_schedule_overrides WHERE student_id IN (${ph})`).bind(...studentIds));
    }
    statements.push(db.prepare(`DELETE FROM enrollments WHERE school_year_id=?`).bind(yearId));
    statements.push(db.prepare(`DELETE FROM classes WHERE school_year_id=?`).bind(yearId));
    statements.push(db.prepare(`DELETE FROM school_years WHERE id=?`).bind(yearId));
    await db.batch(statements);

    let next=null;
    if(Number(year.is_active)===1){
      next=await db.prepare(`SELECT id,label FROM school_years ORDER BY created_at DESC, label DESC LIMIT 1`).first();
      if(next) await db.prepare(`UPDATE school_years SET is_active=CASE WHEN id=? THEN 1 ELSE 0 END`).bind(next.id).run();
    }

    return Response.json({ok:true,action:'delete',deleted_year:year.label,next_year_id:next?.id||null,next_year_label:next?.label||null,no_active_year:!next});
  }catch(error){
    return Response.json({ok:false,error:String(error?.message||error)},{status:500});
  }
}
