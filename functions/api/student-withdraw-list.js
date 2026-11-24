import { verifyTeacherAccess } from './_access-auth.js';
export async function onRequestGet(context) {
  const auth = await verifyTeacherAccess(context.request, context.env);
  if (!auth.ok) return Response.json({ok:false,error:auth.error},{status:auth.status,headers:{'Cache-Control':'no-store'}});
  try {
    const db = context.env?.DB;
    if (!db) return Response.json({ok:false,error:'Base D1 indisponible'},{status:500});
    const year = await db.prepare('SELECT id,label FROM school_years WHERE is_active=1 ORDER BY label DESC LIMIT 1').first();
    if (!year) return Response.json({ok:true,year:null,students:[]},{headers:{'Cache-Control':'no-store'}});
    const {results=[]} = await db.prepare(`
      SELECT s.id AS student_id,s.first_name,s.last_name,c.name AS class_name
      FROM enrollments e JOIN students s ON s.id=e.student_id
      LEFT JOIN classes c ON c.id=e.class_id
      WHERE e.school_year_id=?
      ORDER BY c.name,s.last_name,s.first_name
    `).bind(year.id).all();
    return Response.json({ok:true,year:year.label,students:results},{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('student-withdraw-list failed',error);
    return Response.json({ok:false,error:'Liste indisponible'},{status:500});
  }
}
