"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  local = require("./local.cjs"),
  { id, terms } = require("./definition.cjs");
async function main() {
  const r = await require("./runtime.cjs").runtime(),
    start = performance.now();
  let result;
  try {
    await r
      .service("report/defense-reporting/report.service", "ReportService")
      .statistics(id("user/faculty/1"), { termId: terms[0].id });
    result = { status: "PASS" };
  } catch (e) {
    result = {
      status: "FAIL",
      code: e.code || e.getResponse?.()?.error?.code || e.name,
      message: e.name?.startsWith("Prisma")
        ? e.message
        : e.getResponse?.() || e.message,
    };
  } finally {
    await r.app.close();
  }
  result = {
    ...result,
    database: local.database,
    seconds: (performance.now() - start) / 1000,
    generatedAt: new Date().toISOString(),
    scope:
      "Actual service, standalone rerun of failed UC25-P smoke; not an HTTP replacement",
    productionConnected: false,
  };
  fs.writeFileSync(
    path.join(local.root, "docs/demo-data-v3/evidence/report-diagnostic.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: result.status,
      code: result.code,
      seconds: result.seconds,
    }),
  );
}
main().catch((e) => {
  console.error(e.code || e.message);
  process.exitCode = 1;
});
