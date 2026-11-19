import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  acceptsCheck,
  checkExpression,
  compileCheck,
  sqlAnd,
  sqlOr,
} from "../../../test/sql-review-evaluator";

const review = resolve(__dirname, "../../../prisma/review");
const original = resolve(
  __dirname,
  "../../../test/fixtures/migration-review-v1",
);
const sql = (folder: string, old = false) =>
  readFileSync(
    resolve(old ? original : review, folder, "migration.sql"),
    "utf8",
  );
const hash = "a".repeat(64),
  time = "2030-01-01T00:00:00Z";
const rows = [
  {
    folder: "defense-eligibility",
    name: "eligibility_provenance_valid",
    state: "status",
    row: {
      revision: 1,
      status: "PENDING",
      context: {
        schemaVersion: "1",
        termId: "term",
        termStudentId: "student",
        evidenceHash: hash,
        policyHash: hash,
      },
      reviewed_by: "faculty",
      checked_at: time,
      note: "Synthetic review",
      decided_by: null,
      decided_at: null,
      finalized_by: null,
      finalized_at: null,
    },
  },
  {
    folder: "defense-committee",
    name: "cc_provenance_valid",
    state: "state",
    row: {
      revision: 1,
      state: "DRAFT",
      code: "TEST_CC",
      department_id: "department",
      context: {},
      created_by: "faculty",
      updated_by: "faculty",
      updated_at: time,
      finalized_by: null,
      finalized_at: null,
    },
  },
  {
    folder: "defense-reviewers",
    name: "rw_provenance_valid",
    state: "state",
    row: {
      revision: 1,
      term_id: "term",
      term_student_id: "student",
      committee_id: "committee",
      state: "DRAFT",
      selected: true,
      context: { evidenceHash: hash, policyHash: hash },
      created_by: "faculty",
      updated_by: "faculty",
      updated_at: time,
      finalized_by: null,
      finalized_at: null,
    },
  },
];
describe("UC18-20 real CHECK-expression subset evaluated offline, NOT PostgreSQL", () => {
  for (const item of rows) {
    const check = compileCheck(checkExpression(sql(item.folder), item.name));
    it(`${item.folder}: accepts complete draft/pending provenance`, () =>
      expect(check(item.row)).toBe(true));
    it(`${item.folder}: rejects NULL state which v1 CHECK accepted as UNKNOWN`, () => {
      const bad = { ...item.row, [item.state]: null };
      expect(
        acceptsCheck(
          compileCheck(checkExpression(sql(item.folder, true), item.name))(bad),
        ),
      ).toBe(true);
      expect(check(bad)).toBe(false);
    });
    it(`${item.folder}: rejects an invalid state instead of treating it as legacy`, () =>
      expect(check({ ...item.row, [item.state]: "INVALID" })).toBe(false));
    it(`${item.folder}: preserves baseline revision-zero nullable fields`, () => {
      const legacy = Object.fromEntries(
        Object.keys(item.row).map((k) => [k, k === "revision" ? 0 : null]),
      );
      expect(check(legacy)).toBe(true);
    });
    it(`${item.folder}: rejects incomplete new-row provenance`, () =>
      expect(check({ ...item.row, context: null })).toBe(false));
    it(`${item.folder}: rejects a negative revision`, () =>
      expect(check({ ...item.row, revision: -1 })).toBe(false));
  }
  it("three-valued truth tables preserve FALSE/UNKNOWN differences", () => {
    expect(sqlAnd(null, false)).toBe(false);
    expect(sqlAnd(null, true)).toBeNull();
    expect(sqlOr(null, true)).toBe(true);
    expect(sqlOr(null, false)).toBeNull();
    expect(compileCheck("NULL IS TRUE")({})).toBe(false);
    expect(acceptsCheck(null)).toBe(true);
    expect(() => compileCheck("unsupported_sql @> 'x'")({})).toThrow();
  });
  it.each([null, "INVALID", "FINALIZED"])(
    "UC20 actual INSERT condition rejects %s",
    (state) => {
      const text = sql("defense-reviewers");
      const start = text.indexOf("IF TG_OP='INSERT' AND (NEW.revision<1");
      expect(start).toBeGreaterThan(-1);
      const condition = text
        .slice(start + 3, text.indexOf("THEN", start))
        .trim();
      expect(
        compileCheck(condition)({
          tg_op: "INSERT",
          "new.revision": 1,
          "new.state": state,
        }),
      ).toBe(true);
    },
  );
  it("UC20 draft append at group revision >1 remains permitted", () => {
    const text = sql("defense-reviewers"),
      start = text.indexOf("IF TG_OP='INSERT' AND (NEW.revision<1");
    const condition = compileCheck(
      text.slice(start + 3, text.indexOf("THEN", start)).trim(),
    );
    expect(
      condition({ tg_op: "INSERT", "new.revision": 4, "new.state": "DRAFT" }),
    ).toBe(false);
    expect(
      condition({ tg_op: "INSERT", "new.revision": 0, "new.state": "DRAFT" }),
    ).toBe(true);
  });
});
describe("Actual ROLE_PERMISSION WHERE expressions, offline subset", () => {
  const mappings = [
    {
      folder: "defense-eligibility",
      resource: "defense-eligibility",
      actions: ["read", "review", "decide", "finalize"],
    },
    {
      folder: "defense-committee",
      resource: "defense-committee",
      actions: ["read", "create", "update", "assign", "finalize"],
    },
    {
      folder: "defense-reviewers",
      resource: "defense-reviewer",
      actions: ["read", "assign", "update", "finalize"],
    },
    {
      folder: "defense-scheduling",
      resource: "defense-schedule",
      actions: ["read", "create", "update", "finalize", "publish"],
    },
  ];
  for (const m of mappings) {
    const text = sql(m.folder).split('INSERT INTO public."ROLE_PERMISSION"')[1];
    const condition = compileCheck(
      text.slice(text.indexOf("WHERE") + 5, text.indexOf("ON CONFLICT")).trim(),
    );
    it(`${m.folder}: grants only proposed faculty actions, denies future permission`, () => {
      for (const action of m.actions)
        expect(
          condition({
            "r.name": "FACULTY",
            "p.resource": m.resource,
            "p.action": action,
          }),
        ).toBe(true);
      expect(
        condition({
          "r.name": "FACULTY",
          "p.resource": m.resource,
          "p.action": "future-delete-all",
        }),
      ).toBe(false);
      expect(
        condition({
          "r.name": "ADMIN",
          "p.resource": m.resource,
          "p.action": "read",
        }),
      ).toBe(false);
      expect(
        condition({
          "r.name": "FACULTY",
          "p.resource": "other-resource",
          "p.action": "read",
        }),
      ).toBe(false);
    });
  }
});
describe("UC17 -> UC22 -> UC23 CHECK branches, actual expressions offline", () => {
  const advisor = {
    revision: 1,
    report_version_id: "pdf",
    role: "ADVISOR",
    context: {},
    total_score: 8,
    comment: "Synthetic review",
  };
  it("preserves advisor invariant in both replacements", () => {
    for (const folder of [
      "defense-reviewer-grading",
      "defense-committee-grading",
    ]) {
      const check = compileCheck(
        checkExpression(sql(folder), "final_advisor_score_valid"),
      );
      expect(check(advisor)).toBe(true);
      expect(check({ ...advisor, comment: " " })).toBe(false);
      expect(check({ ...advisor, total_score: null })).toBe(false);
      expect(check({ ...advisor, report_version_id: null, revision: 0 })).toBe(
        true,
      );
    }
  });
  it("UC22 introduces reviewer; UC23 retains reviewer and adds member", () => {
    const rg = compileCheck(
      checkExpression(
        sql("defense-reviewer-grading"),
        "final_advisor_score_valid",
      ),
    );
    const cg = compileCheck(
      checkExpression(
        sql("defense-committee-grading"),
        "final_advisor_score_valid",
      ),
    );
    const reviewer = {
      ...advisor,
      role: "REVIEWER",
      context: { kind: "UC22" },
      total_score: null,
    };
    const member = {
      ...advisor,
      role: "COMMITTEE_MEMBER",
      context: { kind: "UC23" },
    };
    expect(rg(reviewer)).toBe(true);
    expect(cg(reviewer)).toBe(true);
    expect(rg(member)).toBe(false);
    expect(cg(member)).toBe(true);
    expect(cg({ ...member, context: {} })).toBe(false);
    expect(cg({ ...member, total_score: 11 })).toBe(false);
  });
  it.each(["defense-reviewer-grading", "defense-committee-grading"])(
    "%s legacy branch allows baseline fields but denies adoption/owner transfer",
    (folder) => {
      const text = sql(folder),
        marker = "IF NEW.revision=0 AND NEW.report_version_id IS NULL";
      const at = text.indexOf(marker),
        condition = compileCheck(
          text.slice(at + 3, text.indexOf("THEN RETURN NEW", at)).trim(),
        );
      const row = {
        "new.revision": 0,
        "new.report_version_id": null,
        "new.context": null,
        "new.comment": null,
        "new.id": "score",
        "old.id": "score",
        "new.proposal_id": "p",
        "old.proposal_id": "p",
        "new.scorer_id": "l",
        "old.scorer_id": "l",
        "new.role": "REVIEWER",
        "old.role": "REVIEWER",
      };
      expect(condition(row)).toBe(true);
      expect(condition({ ...row, "new.revision": 1 })).toBe(false);
      expect(condition({ ...row, "new.context": { kind: "UC22" } })).toBe(
        false,
      );
      expect(condition({ ...row, "new.proposal_id": "other" })).toBe(false);
    },
  );
});
describe("Visibility contract unit model, not live PostgreSQL RLS", () => {
  const readReference = (
    folder: string,
    fn: string,
    row: unknown,
    rlsFilters: boolean,
  ) => {
    const source = sql(folder),
      at = source.indexOf(`CREATE FUNCTION public.${fn}(`),
      end = source.indexOf("AS $$", at);
    const header = source.slice(at, end);
    if (
      !header.includes("SECURITY INVOKER") ||
      !header.includes("SET row_security=off")
    )
      throw Error("UNSAFE_VISIBILITY_CONFIG");
    if (rlsFilters) throw Error("RLS_VISIBILITY_REQUIRED_MODEL");
    if (row == null) throw Error("REFERENCE_NOT_FOUND_MODEL");
    return row;
  };
  it.each([
    ["defense-committee", "cc_member_guard"],
    ["defense-committee", "cca_transition_guard"],
    ["defense-committee", "cc_final_structure_guard"],
    ["defense-reviewers", "rw_group_guard"],
    ["defense-eligibility", "eligibility_transition_guard"],
    ["defense-scheduling", "sc_conflict_guard"],
    ["defense-reviewer-grading", "rg_detail_guard"],
    ["defense-committee-grading", "cg_detail_guard"],
    ["defense-final-results", "fr_guard"],
    ["defense-final-results", "fr_commit_check"],
  ])(
    "%s/%s: hidden references fail; visible genuine legacy stays distinguishable",
    (folder, fn) => {
      const legacy = { revision: 0 };
      expect(() => readReference(folder, fn, legacy, true)).toThrow(
        "RLS_VISIBILITY_REQUIRED_MODEL",
      );
      expect(() => readReference(folder, fn, null, false)).toThrow(
        "REFERENCE_NOT_FOUND_MODEL",
      );
      expect(readReference(folder, fn, legacy, false)).toBe(legacy);
    },
  );
});

describe("Actual policy and legacy predicates, offline subset", () => {
  const predicate = (folder: string, marker: string) => {
    const text = sql(folder),
      start = text.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    return compileCheck(
      text.slice(start + 3, text.indexOf("THEN", start)).trim(),
    );
  };
  it("UC19 rejects missing/null/count-string/boolean-string policy values", () => {
    const rejects = predicate(
      "defense-committee",
      "IF (policy->>'status'='APPROVED'",
    );
    const policy = {
      status: "APPROVED",
      approvedAt: time,
      chairCount: 1,
      secretaryCount: 1,
      allowEmptyFinalization: false,
    };
    expect(rejects({ policy })).toBe(false);
    for (const key of Object.keys(policy)) {
      expect(rejects({ policy: { ...policy, [key]: null } })).toBe(true);
      const missing: Record<string, unknown> = { ...policy };
      delete missing[key];
      expect(rejects({ policy: missing })).toBe(true);
    }
    expect(rejects({ policy: { ...policy, chairCount: "1" } })).toBe(true);
    expect(rejects({ policy: { ...policy, chairCount: 0.5 } })).toBe(true);
    expect(
      rejects({ policy: { ...policy, allowEmptyFinalization: "false" } }),
    ).toBe(true);
  });
  it("UC24 requires explicit typed confirmation/separation settings, not an invented default", () => {
    const rejects = predicate(
      "defense-final-results",
      "IF (NEW.context#>>'{policy,confirmation,scope}'='STUDENT'",
    );
    const policy = {
      confirmation: {
        scope: "STUDENT",
        rule: "ONE_PER_ROLE",
        distinctActors: false,
        reasonRequired: false,
      },
      separation: {
        finalizerNotConfirmer: false,
        publisherNotFinalizer: false,
      },
    };
    expect(rejects({ "new.context": { policy } })).toBe(false);
    expect(
      rejects({
        "new.context": {
          policy: {
            ...policy,
            confirmation: { ...policy.confirmation, distinctActors: null },
          },
        },
      }),
    ).toBe(true);
    expect(
      rejects({
        "new.context": {
          policy: {
            ...policy,
            separation: {
              ...policy.separation,
              publisherNotFinalizer: "false",
            },
          },
        },
      }),
    ).toBe(true);
    expect(rejects({ "new.context": {} })).toBe(true);
  });
  it("UC24 baseline result maintenance is distinct from adoption or owner transfer", () => {
    const permits = predicate(
      "defense-final-results",
      "IF NEW.revision=0 AND NEW.state='LEGACY_UNVERIFIED'",
    );
    const row = {
      "new.revision": 0,
      "new.state": "LEGACY_UNVERIFIED",
      "new.context": null,
      "new.is_locked": false,
      "new.finalized_by": null,
      "new.finalized_at": null,
      "new.published_by": null,
      "new.id": "r",
      "old.id": "r",
      "new.proposal_id": "p",
      "old.proposal_id": "p",
    };
    expect(permits(row)).toBe(true);
    expect(permits({ ...row, "new.revision": 1 })).toBe(false);
    expect(permits({ ...row, "new.context": { kind: "UC24" } })).toBe(false);
    expect(permits({ ...row, "new.proposal_id": "other" })).toBe(false);
    // IF admits only TRUE; UNKNOWN falls through to the explicit RAISE.
    expect(permits({ ...row, "new.state": null })).toBeNull();
  });
  it("UC24 confirmation evidence must be equal, including missing hash rejection", () => {
    const source = sql("defense-final-results");
    const from = source.indexOf("IF c->>'evidenceHash'"),
      to = source.indexOf("OR NOT EXISTS", from);
    const reject = compileCheck(source.slice(from + 3, to).trim());
    expect(
      reject({
        c: { evidenceHash: hash },
        "new.context": { evidenceHash: hash },
      }),
    ).toBe(false);
    expect(reject({ c: {}, "new.context": { evidenceHash: hash } })).toBe(true);
    expect(
      reject({
        c: { evidenceHash: "b".repeat(64) },
        "new.context": { evidenceHash: hash },
      }),
    ).toBe(true);
  });
});
