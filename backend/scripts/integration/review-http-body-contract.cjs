"use strict";
// Transport-only review probe: same NestFactory defaults as main.ts; no DB/auth.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { NestFactory } = require("@nestjs/core");
const { Controller, Post, Body, Module } = require("@nestjs/common");
const { SubmittedProposalContentSchema } = require("@doan/shared");
class ProbeController {
  probe(body) { SubmittedProposalContentSchema.parse(body); return { accepted: true }; }
}
Controller("probe")(ProbeController);
Post()(ProbeController.prototype, "probe", Object.getOwnPropertyDescriptor(ProbeController.prototype, "probe"));
Body()(ProbeController.prototype, "probe", 0);
class ProbeModule {}
Module({ controllers: [ProbeController] })(ProbeModule);
async function main() {
  const app = await NestFactory.create(ProbeModule, { logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const content = n => ({ schemaVersion: 1, objectives: "\u0111".repeat(n), scope: "\u0111".repeat(n), mainContents: "\u0111".repeat(n), tools: "\u0111".repeat(n), expectedResults: "\u0111".repeat(n), startsAt: "2026-10-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z", schedule: [{ label: "Synthetic stage", startsAt: "2026-10-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z", deliverables: "Synthetic deliverable" }] });
    const cases = [];
    for (const [name, value] of [["small-positive-control", content(10)], ["valid-utf8-content-over-default-json-limit", content(11000)]]) {
      assert(SubmittedProposalContentSchema.safeParse(value).success);
      const body = JSON.stringify(value), response = await fetch("http://127.0.0.1:" + app.getHttpServer().address().port + "/probe", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      cases.push({ name, schemaValid: true, bytes: Buffer.byteLength(body), expectedStatusForValidContract: 201, actualStatus: response.status, result: response.status === 201 ? "PASS" : "FAIL" });
    }
    assert.equal(cases[0].actualStatus, 201);
    assert.equal(cases[1].actualStatus, 413, "Update review if transport default has been fixed");
    const out = path.resolve(__dirname, "../../../docs/implementation/evidence/final-review/http-body-contract.json");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ result: "FAIL", probeAssertionsPassed: true, transportOnly: true, databaseAccess: false, cases }, null, 2) + "\n");
    console.log("REPRODUCED valid contract rejected by default Nest JSON parser: " + cases[1].bytes + " bytes -> 413; small control -> 201");
    process.exitCode = 1; // Preserve the contract mismatch as a failing review finding.
  } finally { await app.close(); }
}
main().catch(() => { console.error("FAIL transport probe setup; no database was accessed"); process.exitCode = 1; });
