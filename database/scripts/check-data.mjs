import { client } from "./db-client.mjs";
const pg = client();
await pg.connect();
try {
  const tables = [
    "USER_ACCOUNT",
    "USER_ROLE",
    "ROLE",
    "PERMISSION",
    "ROLE_PERMISSION",
    "STUDENT",
    "LECTURER",
    "LECTURER_AREA",
    "THESIS_TERM",
    "TERM_PHASE",
    "TERM_PARAMETER",
    "TERM_STUDENT",
    "TERM_LECTURER",
    "TRAINING_SYSTEM",
    "DEPARTMENT",
    "RESEARCH_AREA",
    "ACADEMIC_SEMESTER",
    "TOPIC",
    "REGISTRATION",
    "AUDIT_LOG",
  ];
  for (const t of tables) {
    const res = await pg.query(`SELECT count(*) FROM "${t}"`);
    console.log(`${t}: ${res.rows[0].count}`);
  }
  const users = await pg.query(
    `SELECT u.id, u.username, u.display_name, r.name as role FROM "USER_ACCOUNT" u LEFT JOIN "USER_ROLE" ur ON u.id = ur.user_id LEFT JOIN "ROLE" r ON ur.role_id = r.id`,
  );
  console.log("Users:", users.rows);
  const terms = await pg.query(`SELECT id, code, name FROM "THESIS_TERM"`);
  console.log("Terms:", terms.rows);
} finally {
  await pg.end();
}
