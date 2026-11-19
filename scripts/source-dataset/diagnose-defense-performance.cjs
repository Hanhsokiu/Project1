"use strict";
// Read-only profiling of existing production services. No credentials or row data in output.
const assert = require("node:assert/strict");
const { req, read, save, safeError } = require("./context.cjs");
const { environment, targetInfo } = require("./preflight.cjs");
const { defenseRuntime } = require("./defense-runtime.cjs");
async function main() {
  const target = targetInfo(environment());
  assert.equal(target.projectRef, "zlsygwjskvxgtzdjhvzt");
  const term = read("foundation-report.json").termId;
  const actor = read("faculty-report.json").userId;
  assert.ok(term && actor);
  const mode = process.argv[2] || "reviewer-list";
  assert.ok(["reviewer-list", "committee-workspace", "committee-grade-list"].includes(mode));
  const metrics = { queries: 0, queryMilliseconds: 0, tables: {}, tableMilliseconds: {}, slowestQueries: [], calls: {} };
  const db = new (req("@prisma/client").PrismaClient)({
    datasources: { db: { url: target.url } },
    log: [{ emit: "event", level: "query" }],
  });
  db.$on("query", event => {
    metrics.queries++;
    metrics.queryMilliseconds += event.duration;
    const table = /(?:FROM|JOIN)\s+"public"\."([A-Z_]+)"/.exec(event.query)?.[1] || "OTHER";
    metrics.tables[table] = (metrics.tables[table] || 0) + 1;
    metrics.tableMilliseconds[table] = (metrics.tableMilliseconds[table] || 0) + event.duration;
    metrics.slowestQueries.push({ table, milliseconds: event.duration });
    metrics.slowestQueries.sort((a,b)=>b.milliseconds-a.milliseconds);
    metrics.slowestQueries.length=Math.min(8,metrics.slowestQueries.length);
  });
  // Keep each repository's real isolation and deadline, adding DB-enforced read-only mode.
  const readonly = new Proxy(db, { get(object, key) {
    if (key === "$transaction") return (callback, options) => db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      if (process.argv.includes("--disable-jit")) await tx.$executeRawUnsafe("SET LOCAL jit = off");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30000ms'");
      return callback(tx);
    }, options);
    return typeof object[key] === "function" ? object[key].bind(object) : object[key];
  } });
  const runtime = defenseRuntime(readonly, term);
  for (const [name, service, methods] of [
    ["committees", runtime.committees, ["workspaceInSession", "effectiveInSession"]],
    ["reviewers", runtime.reviewers, ["workspaceInSession", "effectiveInSession"]],
    ["schedule", runtime.schedule, ["effectiveInSession"]],
    ["eligibility", runtime.eligibility, ["forCommittee"]],
  ]) for (const method of methods) {
    const original = service[method].bind(service);
    service[method] = async (...args) => {
      const key = name + "." + method;
      const counter = metrics.calls[key] ||= { started: 0, completed: 0, milliseconds: 0 };
      counter.started++;
      const start = performance.now();
      try { const result = await original(...args); counter.completed++; return result; }
      finally { counter.milliseconds += Math.round(performance.now() - start); }
    };
  }
  const start = performance.now();
  let outcome;
  try {
    const value = mode === "committee-workspace"
      ? await runtime.committees.workspace(actor, term)
      : await (mode === "reviewer-list" ? runtime.reviewerGrades : runtime.committeeGrades)
        .list(actor, { termId: term, page: 1, limit: process.argv.includes("--all-rows") ? 100 : 20, search: "" });
    outcome = { success: true, returnedItems: value.items?.length, total: value.total, committees: value.committees?.length,
      currentCommittees: value.committees?.filter(row=>row.downstream).length,
      states: value.items ? value.items.reduce((counts,row)=>{counts[row.state]=(counts[row.state]||0)+1;return counts;},{}) : undefined };
  } catch (error) {
    outcome = { success: false, errorCode: error.code || error.errorCode || "UNKNOWN", errorType: error.name };
  } finally { try { await db.$disconnect(); } catch { outcome = { ...outcome, disconnectFailed: true }; } }
  const report = { operation: "READ_ONLY", observedAt: new Date().toISOString(), mode,
    elapsedMilliseconds: Math.round(performance.now() - start), repositoryDeadlineUnchanged: true,
    ...outcome, ...metrics, supabaseWrites: 0, httpMiddlewareMeasured: false };
  report.jitDisabled = process.argv.includes("--disable-jit");
  save("performance-" + mode + (report.jitDisabled ? ".jit-off" : "") + (process.argv.includes("--all-rows") ? ".all-rows" : "") + ".json", report);
  console.log(JSON.stringify(report));
}
if (require.main === module) main().catch(safeError);
