import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "backend/package.json"));
const bcrypt = require("bcryptjs");
import { connectDisposableTestClient, verifyDisposableTestIdentity } from "./disposable-test-target.mjs";

const { client: pg, target } = await connectDisposableTestClient(process.env);

try {
  await pg.query("BEGIN");
  await verifyDisposableTestIdentity(pg, target);

  console.log("Cleaning operational tables...");

  // 1. Truncate / delete all student, lecturer, topic, term, guidance, defense tables
  const tablesToTruncate = [
    "AUDIT_LOG",
    "LOGIN_SESSION",
    "NOTIFICATION",
    "EXPORT_JOB",
    "IMPORT_JOB",
    "SCORE_DETAIL",
    "SCORE_ENTRY",
    "FINAL_RESULT",
    "DEFENSE_MINUTES",
    "DEFENSE_SESSION",
    "DEFENSE_CONFIRMATION",
    "DEFENSE_ELIGIBILITY",
    "COMMITTEE_STUDENT",
    "COMMITTEE_MEMBER",
    "DEFENSE_COMMITTEE",
    "DEFERMENT_REQUEST",
    "FINAL_REPORT",
    "GUIDANCE_MEETING",
    "SUBMISSION_FILE",
    "TASK_SUBMISSION",
    "TASK_REVIEW",
    "TASK",
    "GUIDANCE_PLAN",
    "PROPOSAL_VERSION",
    "PROPOSAL_REVIEW",
    "PROPOSAL",
    "TOPIC_HISTORY",
    "TOPIC",
    "REGISTRATION_PREF",
    "REGISTRATION",
    "REVIEWER_ASSIGNMENT",
    "ADVISOR_ASSIGNMENT",
    "ASSIGNMENT_PLAN",
    "REVIEW_GROUP_MEMBER",
    "REVIEW_GROUP",
    "PHASE_EVALUATION",
    "THESIS_DOSSIER",
    "TERM_PHASE",
    "TERM_PARAMETER",
    "TERM_STUDENT",
    "TERM_LECTURER",
    "THESIS_TERM",
    "STUDENT",
    "LECTURER_AREA",
    "LECTURER",
  ];

  for (const table of tablesToTruncate) {
    try {
      await pg.query(`DELETE FROM "${table}"`);
      console.log(`Cleared ${table}`);
    } catch (e) {
      console.warn(`Could not clear ${table}: ${e.message}`);
    }
  }

  // 2. Clean test ACADEMIC_SEMESTER, keep only 1 clean standard semester (or reset)
  await pg.query(`DELETE FROM "ACADEMIC_SEMESTER"`);
  await pg.query(`
    INSERT INTO "ACADEMIC_SEMESTER" (id, academic_year, semester, name, start_date, end_date, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      '2026-2027',
      1,
      '2026 – 2027 / Học kỳ I',
      '2026-09-01 00:00:00+07',
      '2027-07-31 23:59:59+07',
      NOW(),
      NOW()
    )
    ON CONFLICT (academic_year, semester) DO NOTHING
  `);
  console.log("Reset ACADEMIC_SEMESTER to standard 2026-2027 HK1.");

  // 3. Keep ONLY admin in USER_ACCOUNT and USER_ROLE
  // Find admin user
  const adminRes = await pg.query(
    `SELECT id FROM "USER_ACCOUNT" WHERE username = 'admin'`,
  );
  let adminId;

  const adminRoleRes = await pg.query(
    `SELECT id FROM "ROLE" WHERE name = 'ADMIN'`,
  );
  if (!adminRoleRes.rows.length) {
    throw new Error("Role ADMIN not found");
  }
  const adminRoleId = adminRoleRes.rows[0].id;

  if (adminRes.rows.length > 0) {
    adminId = adminRes.rows[0].id;
    // Delete non-admin user roles
    await pg.query(`DELETE FROM "USER_ROLE" WHERE user_id != $1`, [adminId]);
    // Delete non-admin user accounts
    await pg.query(`DELETE FROM "USER_ACCOUNT" WHERE id != $1`, [adminId]);
    // Ensure admin user role is ADMIN
    await pg.query(
      `INSERT INTO "USER_ROLE" (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [adminId, adminRoleId],
    );
    // Update admin user to ensure active and correct display name
    await pg.query(
      `UPDATE "USER_ACCOUNT" SET display_name = 'Quản trị viên', status = 'ACTIVE', must_change_password = false WHERE id = $1`,
      [adminId],
    );
  } else {
    // Delete all user roles and user accounts
    await pg.query(`DELETE FROM "USER_ROLE"`);
    await pg.query(`DELETE FROM "USER_ACCOUNT"`);

    const passwordHash = await bcrypt.hash("Demo@2026", 12);
    const insertRes = await pg.query(
      `INSERT INTO "USER_ACCOUNT" (id, username, display_name, email, password_hash, status, must_change_password, created_at, updated_at)
       VALUES (gen_random_uuid(), 'admin', 'Quản trị viên', 'admin@utc.edu.vn', $1, 'ACTIVE', false, NOW(), NOW())
       RETURNING id`,
      [passwordHash],
    );
    adminId = insertRes.rows[0].id;
    await pg.query(
      `INSERT INTO "USER_ROLE" (user_id, role_id) VALUES ($1, $2)`,
      [adminId, adminRoleId],
    );
  }

  // Ensure all permissions are mapped to ADMIN role
  await pg.query(`
    INSERT INTO "ROLE_PERMISSION" (role_id, permission_id)
    SELECT $1, id FROM "PERMISSION"
    ON CONFLICT DO NOTHING
  `, [adminRoleId]);

  await pg.query("COMMIT");
  console.log("Database successfully cleaned! Only admin account remains.");
} catch {
  await pg.query("ROLLBACK");
  console.error("Cleanup aborted and rolled back; diagnostic details suppressed.");
  process.exitCode = 1;
} finally {
  await pg.end();
}
