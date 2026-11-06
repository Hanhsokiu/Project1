"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict"), { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../../.."), req = createRequire(path.join(root, "backend/package.json"));
const { PrismaClient } = req("@prisma/client");
const run = fs.readFileSync(path.join(__dirname, "../latest-run.txt"), "utf8").trim(), dir = path.join(__dirname, "..", run), out = path.join(dir, "database"); fs.mkdirSync(out, { recursive: true });
const quote = value => '"' + value.replaceAll('"', '""') + '"';
async function main() {
  const summary = JSON.parse(fs.readFileSync(path.join(dir, "run-summary.json"), "utf8"));
  const target = summary.cases.find(x => x.name === "live-e2e").database; assert(/^btl_pr2b_audit_[a-z0-9_]+$/.test(target));
  const config = JSON.parse(fs.readFileSync(path.join(root, ".cache/integration-ui/config.json"), "utf8"));
  const db = new PrismaClient({ datasources: { db: { url: `postgresql://btl_ui:${config.password}@127.0.0.1:55451/${target}` } } });
  const result = { startedAt: new Date().toISOString(), database: target, readOnlyAudit: true, orphanChecks: [], invariants: [] };
  try {
    result.identity = await db.$queryRawUnsafe("SELECT current_database() AS name,current_setting('server_version_num') AS version");
    result.constraints = await db.$queryRawUnsafe(`SELECT c.conname,c.contype,c.convalidated,t.relname AS table_name,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' ORDER BY t.relname,c.conname`);
    result.indexes = await db.$queryRawUnsafe("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
    result.triggers = await db.$queryRawUnsafe("SELECT event_object_table,trigger_name,event_manipulation,action_timing FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table,trigger_name");
    result.migrations = (await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).map(m => {
      const file = path.join(root, "backend/prisma/migrations", m.migration_name, "migration.sql");
      return { name: m.migration_name, finished: !!m.finished_at, rolledBack: !!m.rolled_back_at, sourceChecksumMatches: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") === m.checksum };
    });
    const fks = await db.$queryRawUnsafe(`SELECT c.conname,t.relname AS child,p.relname AS parent,array_agg(a.attname ORDER BY keys.ord) AS child_cols,array_agg(b.attname ORDER BY keys.ord) AS parent_cols FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_class p ON p.oid=c.confrelid JOIN pg_namespace n ON n.oid=t.relnamespace CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY keys(ca,pa,ord) JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=keys.ca JOIN pg_attribute b ON b.attrelid=p.oid AND b.attnum=keys.pa WHERE c.contype='f' AND n.nspname='public' GROUP BY c.conname,t.relname,p.relname ORDER BY c.conname`);
    for (const fk of fks) {
      const nonnull = fk.child_cols.map(c => `c.${quote(c)} IS NOT NULL`).join(" AND "), match = fk.child_cols.map((c, i) => `c.${quote(c)}=p.${quote(fk.parent_cols[i])}`).join(" AND ");
      const [row] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count FROM public.${quote(fk.child)} c WHERE ${nonnull} AND NOT EXISTS (SELECT 1 FROM public.${quote(fk.parent)} p WHERE ${match})`);
      result.orphanChecks.push({ constraint: fk.conname, child: fk.child, parent: fk.parent, orphanCount: row.count });
    }
    const tasks = await db.taskWorkflow.findMany({ include: { refCurrentSubmissionId: { include: { pr2bSubmissionWorkflowSubmissionId: { include: { refEffectiveReviewId: true } } } } } });
    for (const task of tasks) {
      const sub = task.refCurrentSubmissionId, workflow = sub?.pr2bSubmissionWorkflowSubmissionId;
      result.invariants.push({ name: "task-current-submission-owner", taskId: task.taskId, result: !sub || (sub.taskId === task.taskId && workflow?.taskId === task.taskId) ? "PASS" : "FAIL" });
      if (task.state === "COMPLETED") result.invariants.push({ name: "completed-task-has-effective-PASS", taskId: task.taskId, result: workflow?.refEffectiveReviewId?.decision === "PASS" && workflow.refEffectiveReviewId.state === "RECORDED" ? "PASS" : "FAIL" });
    }
    result.counts = {};
    for (const model of ["proposalVersion", "proposalReviewDecision", "dossierFinalization", "dossierReceipt", "guidancePlan", "task", "taskSubmission", "progressReview", "notification", "finalResult", "defenseEligibility"])
      result.counts[model] = await db[model].count();
    result.auditActions = await db.auditLog.groupBy({ by: ["action"], _count: { _all: true } });
    result.notificationTitles = await db.notification.findMany({ select: { title: true } });
    result.outboxTypes = await db.outboxEvent.groupBy({ by: ["type"], _count: { _all: true } });
    const sampleTask = await db.task.findFirst();
    if (sampleTask) result.tinyFixtureExplain = await db.$queryRawUnsafe('EXPLAIN (FORMAT JSON) SELECT * FROM "TASK_SUBMISSION" WHERE task_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20', sampleTask.id);
  } finally { await db.$disconnect(); result.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(result, (_, value) => typeof value === "bigint" ? value.toString() : value, 2)); }
}
main().catch(e => { console.error(String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED]")); process.exitCode = 1; });
