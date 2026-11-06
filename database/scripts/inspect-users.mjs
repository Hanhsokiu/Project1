import { client } from "./db-client.mjs";

const pg = client();
await pg.connect();

try {
  const students = await pg.query(`SELECT * FROM "STUDENT"`);
  console.log("=== STUDENTS IN DB ===", students.rows);

  const lecturers = await pg.query(`SELECT * FROM "LECTURER"`);
  console.log("=== LECTURERS IN DB ===", lecturers.rows);
} finally {
  await pg.end();
}
