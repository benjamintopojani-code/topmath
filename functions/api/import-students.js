function clean(value){ return String(value ?? '').trim(); }
function normalize(value){
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
}
function normalizePhase(value){
  const m=clean(value).match(/([123])/);
  return m ? `Phase ${m[1]}` : 'Phase 1';
}
function inferTrack(name){
  const n=normalize(name);
  return /\beco\b|economie|travaux\s*bureau|travaux\s*magasin|bureau|magasin/.test(n) ? 'ECO' : 'NORMAL';
}
function makeAccessCode(used){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(let tries=0; tries<100; tries++){
    let code='';
    const bytes=new Uint8Array(8); crypto.getRandomValues(bytes);
    for(const b of bytes) code+=alphabet[b%alphabet.length];
    if(!used.has(code)){ used.add(code); return code; }
  }
  const code=crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
  used.add(code); return code;
}
export async function onRequestPost(context){
  try{
    const db=context.env.DB;
    if(!db) return Response.json({ok:false,error:'Binding DB absent'},{status:500});
    const body=await context.request.json().catch(()=>null);
    const rows=Array.isArray(body?.rows)?body.rows:[];
    const requestedTracks=body?.class_tracks && typeof body.class_tracks==='object' ? body.class_tracks : {};
    if(!rows.length) return Response.json({ok:false,error:'Aucun élève à importer'},{status:400});
    if(rows.length>1000) return Response.json({ok:false,error:'Maximum 1000 élèves par import'},{status:400});

    let year=await db.prepare(`SELECT id,label FROM school_years WHERE is_active=1 ORDER BY created_at DESC, label DESC LIMIT 1`).first();
    let createdYear=false;
    if(!year){
      const baseLabel=clean(body?.year_label);
      if(!/^\d{4}-\d{4}$/.test(baseLabel)) return Response.json({ok:false,error:'Aucune année scolaire active. Indique une année au format 2027-2028.'},{status:400});
      const {results:existingYears=[]}=await db.prepare(`SELECT label FROM school_years WHERE label=? OR label LIKE ?`).bind(baseLabel,baseLabel+' (%)').all();
      const used=new Set(existingYears.map(r=>String(r.label||'')));
      let label=baseLabel;
      if(used.has(label)){let n=1;while(used.has(`${baseLabel} (${n})`))n++;label=`${baseLabel} (${n})`;}
      const id=crypto.randomUUID();
      await db.batch([
        db.prepare(`UPDATE school_years SET is_active=0 WHERE is_active=1`),
        db.prepare(`INSERT INTO school_years (id,label,is_active) VALUES (?,?,1)`).bind(id,label)
      ]);
      year={id,label};
      createdYear=true;
    }

    const {results:classRows}=await db.prepare(`SELECT id,name,track,phase FROM classes WHERE school_year_id=?`).bind(year.id).all();
    const classes=new Map((classRows||[]).map(c=>[normalize(c.name),{...c,new:false}]));
    const {results:existingRows}=await db.prepare(`
      SELECT s.first_name,s.last_name,e.class_id
      FROM enrollments e JOIN students s ON s.id=e.student_id
      WHERE e.school_year_id=?
    `).bind(year.id).all();
    const duplicates=new Set((existingRows||[]).map(r=>`${normalize(r.first_name)}|${normalize(r.last_name)}|${r.class_id||''}`));
    const {results:codes}=await db.prepare(`SELECT access_code FROM students WHERE access_code IS NOT NULL`).all();
    const usedCodes=new Set((codes||[]).map(r=>clean(r.access_code)).filter(Boolean));

    const prepared=[];
    for(const raw of rows){
      const first=clean(raw?.first), last=clean(raw?.name ?? raw?.last), className=clean(raw?.class), phase=normalizePhase(raw?.phase);
      if(!first||!last||!className) continue;
      const key=normalize(className);
      let cls=classes.get(key);
      if(!cls){
        const proposed=clean(requestedTracks[key] ?? requestedTracks[className] ?? '').toUpperCase();
        const track=proposed==='ECO'?'ECO':proposed==='NORMAL'?'NORMAL':inferTrack(className);
        cls={id:crypto.randomUUID(),name:className,track,phase,new:true};
        classes.set(key,cls);
      }
      prepared.push({first,last,phase,cls});
    }
    if(!prepared.length) return Response.json({ok:false,error:'Aucune ligne valide'},{status:400});

    const statements=[];
    let createdClasses=0,addedStudents=0,skipped=0,generatedCodes=0;
    for(const cls of classes.values()){
      if(cls.new){
        statements.push(db.prepare(`INSERT INTO classes (id,school_year_id,name,track,phase) VALUES (?,?,?,?,?)`).bind(cls.id,year.id,cls.name,cls.track,cls.phase));
        createdClasses++;
      }
    }
    const seenThisImport=new Set();
    for(const row of prepared){
      const dupKey=`${normalize(row.first)}|${normalize(row.last)}|${row.cls.id}`;
      if(duplicates.has(dupKey)||seenThisImport.has(dupKey)){skipped++;continue}
      seenThisImport.add(dupKey);
      const studentId=crypto.randomUUID(), enrollmentId=crypto.randomUUID(), accessCode=makeAccessCode(usedCodes);
      statements.push(db.prepare(`INSERT INTO students (id,last_name,first_name,birth_date,access_code) VALUES (?,?,?,?,?)`).bind(studentId,row.last,row.first,null,accessCode));
      statements.push(db.prepare(`INSERT INTO enrollments (id,student_id,class_id,school_year_id,phase,sector,professional_group,job) VALUES (?,?,?,?,?,?,?,?)`).bind(enrollmentId,studentId,row.cls.id,year.id,row.phase,null,null,null));
      addedStudents++;generatedCodes++;
    }
    if(statements.length) await db.batch(statements);
    return Response.json({ok:true,year:year.label,created_year:createdYear,created_classes:createdClasses,added_students:addedStudents,skipped_duplicates:skipped,generated_codes:generatedCodes});
  }catch(error){
    return Response.json({ok:false,error:String(error?.message||error)},{status:500});
  }
}
