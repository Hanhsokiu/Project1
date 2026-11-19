"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module");
const { id, date, terms } = require("./definition.cjs");
function builder(local) {
  // Reuse the reviewed PURE technical policy builder, not the approval service.
  // No official faculty approval is claimed. Its TEST marker enforces local DB runtime gates.
  const source = path.join(local.backend, "src/acceptance/policy-bundle.ts"),
    filename = path.join(local.backend, "dist/acceptance/policy-bundle.js");
  const ts = local.req("typescript"),
    code = ts.transpileModule(fs.readFileSync(source, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2021,
      },
    }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(code, filename);
  return compiled.exports;
}
async function seedPolicies(ctx) {
  const t = terms[0];
  await ctx.phase("synthetic-test-policy-configuration", async (tx) => {
    const rooms = [];
    for (let i = 1; i <= 3; i++) {
      const roomId = id("room/" + i);
      await ctx.put(tx, "room", {
        id: roomId,
        code: "DEMO-P" + i,
        name: "Phòng bảo vệ mô phỏng " + i,
        capacity: 40,
        location: "Môi trường TEST; không phải lịch sử sử dụng phòng thật",
        createdAt: date("2026-02-01"),
      });
      rooms.push(roomId);
    }
    const module = builder(ctx.local),
      bundle = module.buildAcceptancePolicies({
        runId: "DATN-E2E-B1B10-TEST-UTC-DEMO-V3",
        termId: t.id,
        departmentId: id("department"),
        roomId: rooms[0],
        approvedBy: id("user/faculty/1"),
        approvedAt: date("2026-02-01").toISOString(),
        startAt: date(t.start).toISOString(),
        endAt: date(t.end).toISOString(),
        defenseDate: "2026-07-06",
        reviewerCriteriaIds: Array.from({ length: 5 }, (_, i) =>
          id("reviewer-rubric/" + i),
        ),
        committeeCriteriaIds: Array.from({ length: 5 }, (_, i) =>
          id("committee-rubric/" + i),
        ),
      });
    const p = bundle.policies;
    // These policies are created before any producer uses them in the new V4 DB.
    p.UC24_POLICY.storageDecimalPlaces = 2;
    p.UC24_POLICY.finalStep = "0.01";
    p.UC24_POLICY.finalRounding = { mode: "HALF_UP", decimalPlaces: 2 };
    p.UC24_POLICY.reviewerAggregate.rounding = { mode: "HALF_UP", decimalPlaces: 2 };
    p.UC24_POLICY.committeeAggregate.rounding = { mode: "HALF_UP", decimalPlaces: 2 };
    p.UC19_POLICY.maxStudentsPerCommittee = 25;
    p.UC19_POLICY.maxStudentsPerLecturer = 25;
    p.UC20_POLICY.maxReviewsPerLecturer = 15;
    p.UC20_POLICY.maxTotalStudentDuties = 80;
    p.UC21_POLICY.allowedDates = [
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
    ];
    p.UC21_POLICY.roomAccess = rooms.map((roomId) => ({
      roomId,
      departmentIds: [id("department")],
    }));
    p.UC25_POLICY.retentionDays = 3650;
    p.UC25_POLICY.templates = p.UC25_POLICY.templates.map((template) => ({
      ...template,
      effectiveUntil: null,
    }));
    // Keep the existing one-decimal storage policy explicit. Two-decimal equivalence is BLOCKED.
    for (const [key, value] of Object.entries(p)) {
      module.acceptancePolicySchemas[key].parse(value);
      await ctx.put(tx, "termParameter", {
        id: id("policy/" + key),
        termId: t.id,
        key,
        value: JSON.stringify(value),
        description:
          "SYNTHETIC TEST FIXTURE — technical choices for requested demo size; NOT official faculty approval",
        createdAt: date("2026-02-01"),
        updatedAt: date("2026-02-01"),
      });
    }
    for (const c of [
      ...p.UC22_POLICY.rubric.criteria,
      ...p.UC23_POLICY.rubric.criteria,
    ])
      await ctx.put(tx, "rubricCriteria", {
        id: c.id,
        termId: t.id,
        name: c.name,
        description: c.description ?? null,
        weight: c.weight,
        maxScore: c.maxScore,
        createdAt: date("2026-02-01"),
      });
    const extra =
      require("../../backend/scripts/acceptance/provision.cjs").extra;
    for (const [role, permissions] of Object.entries(extra))
      for (const value of permissions) {
        const [resource, action] = value.split(":"),
          r = await tx.role.findUniqueOrThrow({ where: { name: role } }),
          permission = await tx.permission.findUniqueOrThrow({
            where: { resource_action: { resource, action } },
          });
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: r.id, permissionId: permission.id },
          },
          create: { roleId: r.id, permissionId: permission.id },
          update: {},
        });
      }
    const committeeRole = await tx.role.findUniqueOrThrow({
      where: { name: "COMMITTEE" },
    });
    for (let i = 1; i <= 12; i++)
      await tx.userRole.create({
        data: {
          userId: id("user/gv/" + i),
          roleId: committeeRole.id,
          assignedAt: date("2026-07-01"),
        },
      });
    await ctx.put(tx, "auditLog", {
      id: id("audit/test-policy"),
      action: "SYNTHETIC_DEMO_POLICY_CONFIGURATION",
      resource: "demo-fixture",
      resourceId: t.id,
      newValue: {
        synthetic: true,
        officialFacultyApproval: false,
        reference:
          "User-requested DEMO V3; pure acceptance builder reused as fixture input",
        storageDecimalPlaces: 1,
        targetCommitteeSize: 4,
        targetStudentsPerCommittee: 20,
      },
      createdAt: date("2026-02-01"),
    });
  });
  await ctx.phase("synthetic-demo-export-retention", async (tx) => {
    const row = await tx.termParameter.findUniqueOrThrow({
        where: { termId_key: { termId: t.id, key: "UC25_POLICY" } },
      }),
      policy = JSON.parse(row.value);
    if (
      policy.retentionDays === 3650 &&
      policy.templates.every((template) => template.effectiveUntil === null)
    )
      return;
    const assert = require("node:assert/strict");
    assert.equal(
      await tx.auditLog.count({
        where: { resource: "defense-report", action: "EXPORT_GENERATED" },
      }),
      0,
      "Do not change export policy after first use",
    );
    assert(
      policy.reference.startsWith("PROJECT_ACCEPTANCE_ONLY:"),
      "Only synthetic TEST configuration may be initialized",
    );
    policy.retentionDays = 3650;
    policy.templates = policy.templates.map((template) => ({
      ...template,
      effectiveUntil: null,
    }));
    ctx.local.req("@doan/shared").ReportPolicySchema.parse(policy);
    await tx.termParameter.update({
      where: { id: row.id },
      data: { value: JSON.stringify(policy) },
    });
  });
}
module.exports = { builder, seedPolicies };
