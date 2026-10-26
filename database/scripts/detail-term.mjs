import { client } from "./db-client.mjs";

const pg = client();
await pg.connect();

try {
  const termRes = await pg.query(`SELECT * FROM "THESIS_TERM"`);
  console.log("=== TERMS ===");
  console.log(termRes.rows);

  const term = termRes.rows[0];
  if (term) {
    const phasesRes = await pg.query(
      `SELECT * FROM "TERM_PHASE" WHERE term_id = $1`,
      [term.id]
    );
    console.log("=== PHASES ===");
    console.log(phasesRes.rows);

    const paramsRes = await pg.query(
      `SELECT * FROM "TERM_PARAMETER" WHERE term_id = $1`,
      [term.id]
    );
    console.log("=== PARAMETERS ===");
    console.log(paramsRes.rows);

    const studentsRes = await pg.query(
      `SELECT ts.*, s.student_code, s.full_name, s.gpa, s.is_eligible 
       FROM "TERM_STUDENT" ts 
       JOIN "STUDENT" s ON ts.student_id = s.id 
       WHERE ts.term_id = $1`,
      [term.id]
    );
    console.log("=== TERM STUDENTS ===");
    console.log(studentsRes.rows);

    const lecturersRes = await pg.query(
      `SELECT tl.*, l.lecturer_code, l.full_name, tl.quota 
       FROM "TERM_LECTURER" tl 
       JOIN "LECTURER" l ON tl.lecturer_id = l.id 
       WHERE tl.term_id = $1`,
      [term.id]
    );
    console.log("=== TERM LECTURERS ===");
    console.log(lecturersRes.rows);
  }
} finally {
  await pg.end();
}
