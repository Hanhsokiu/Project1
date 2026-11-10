import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";
import type { FileAsset } from "@prisma/client";
import { finalAssetIntegrityModel } from "../../../test/final-asset-integrity.fixture";
import {
  createFinalDefenseFixture,
  ids,
  syntheticFile,
} from "../../../test/final-defense.fixture";
import { SubmissionValidator } from "../submissions/submission.validator";
import { approvedSubmissionPolicy } from "../submissions/submission-policy";

const review = resolve(__dirname, "../../../prisma/review/final-defense");
const sql = readFileSync(resolve(review, "migration.sql"), "utf8");
const rollback = readFileSync(
  resolve(review, "rollback.empty-only.sql"),
  "utf8",
);
const fn = (name: string) => {
  const start = sql.indexOf(`CREATE FUNCTION public.${name}()`);
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("END $$;", start) + 7);
};
function syntheticAsset(): FileAsset {
  const file = syntheticFile();
  const metadata = new SubmissionValidator().file("REPORT", file, {
    ...approvedSubmissionPolicy,
    policyId: "TEST_ONLY_FINAL_ASSET_REVIEW",
    maxFileBytes: 1048576,
  });
  return {
    ...metadata,
    id: ids.proposal,
    state: "READY",
    storageKey: `guidance/${ids.proposal}`,
    createdByUserId: ids.student,
    createdAt: new Date("2030-01-01T00:00:00Z"),
    updatedAt: new Date("2030-01-01T00:00:00Z"),
  };
}
describe("UC17 SQL review static contracts — no database execution", () => {
  it("guards all final asset metadata and DELETE, permits an exact no-op and leaves staging conditional", () => {
    const body = fn("final_pdf_asset_immutable");
    expect(body).toContain("WHERE file_asset_id=OLD.id");
    expect(body).toContain("IF TG_OP='DELETE' THEN");
    expect(body).toContain("to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD)");
    expect(body).not.toContain("ARRAY["); // No silently mutable state/timestamp whitelist.
    expect(body).toContain("ERRCODE='23514'");
    expect(body).toContain("SET row_security=off");
    expect(body).not.toContain("SECURITY DEFINER");
    expect(sql).toContain(
      'final_pdf_asset_immutable BEFORE UPDATE OR DELETE ON public."FILE_ASSET"',
    );
    expect(body).not.toMatch(/FOR UPDATE|UPDATE public\.|DELETE FROM/);
  });
  it("both claim directions write the same row before checking ownership; lock-only is insufficient", () => {
    for (const name of ["final_pdf_asset_check", "final_pdf_no_weekly_reuse"]) {
      const body = fn(name);
      expect(body).toContain("LANGUAGE plpgsql VOLATILE");
      expect(body).toContain("SET row_security=off");
      expect(body).toContain("IF NOT FOUND THEN");
      expect(body).toContain('UPDATE public."FILE_ASSET" SET id=id WHERE id=');
      expect(body.indexOf('UPDATE public."FILE_ASSET"')).toBeLessThan(
        body.indexOf(
          name === "final_pdf_asset_check" ? "IF NOT EXISTS" : "IF EXISTS",
        ),
      );
      expect(body).not.toMatch(/SET .*updatedAt/);
    }
    expect(sql).toContain(
      'final_pdf_no_weekly_submission BEFORE INSERT OR UPDATE OF "fileId"',
    );
    expect(sql).toContain(
      'final_pdf_no_weekly_upload BEFORE INSERT OR UPDATE OF "assetId"',
    );
  });
  it("keeps both weekly exclusions, final uniqueness and proposal/score/decision binding", () => {
    const body = fn("final_pdf_asset_check");
    for (const name of ["SUBMISSION_ASSET", "GUIDANCE_SUBMISSION_UPLOAD"])
      expect(body).toContain(`FROM public."${name}"`);
    for (const condition of [
      'a."createdByUserId"=s.user_id',
      "s.id=p.student_id",
      "p.id=r.proposal_id",
      "a.kind='REPORT'",
      "a.state='READY'",
      "a.\"mimeType\"='application/pdf'",
      'a."sizeBytes">0',
      "a.checksum ~ '^[0-9a-f]{64}$'",
      "a.\"storageKey\" ~ '^guidance/[0-9a-f-]{36}$'",
      "a.\"storageKey\"='guidance/' || a.id",
    ])
      expect(body).toContain(condition);
    expect(sql).toContain("file_asset_id VARCHAR(36) NOT NULL UNIQUE");
    expect(sql).toContain(
      'final_pdf_immutable BEFORE UPDATE OR DELETE ON public."FINAL_REPORT_VERSION"',
    );
    expect(fn("final_decision_owner_check")).toContain(
      "r.proposal_id=NEW.proposal_id",
    );
  });
  it("rollback removes only the new asset guard before dropping its referenced table, retains baseline protections", () => {
    expect(rollback).toContain(
      'LOCK TABLE public."FILE_ASSET",public."SUBMISSION_ASSET"',
    );
    expect(rollback).toContain("IN ACCESS EXCLUSIVE MODE NOWAIT");
    expect(rollback.indexOf("UC17 data/staging exists")).toBeLessThan(
      rollback.indexOf("DROP TRIGGER"),
    );
    expect(
      rollback.indexOf("DROP FUNCTION public.final_pdf_asset_immutable()"),
    ).toBeLessThan(
      rollback.indexOf('DROP TABLE public."FINAL_REPORT_VERSION"'),
    );
    expect(rollback).not.toMatch(
      /DROP (?:TRIGGER|FUNCTION) (?:public\.)?step8b_/,
    );
    expect(rollback).not.toMatch(/\bCASCADE\b|DELETE FROM|TRUNCATE/);
  });
});
describe("UC17 synthetic reference-model integrity — NOT PostgreSQL trigger tests", () => {
  const setup = () => {
    const m = finalAssetIntegrityModel(),
      a = syntheticAsset();
    m.add(a);
    return { m, a };
  };
  it("source-generated synthetic metadata satisfies the final claim and bytes hash contract", () => {
    const { m, a } = setup();
    m.final(a.id, ids.student, "v1");
    expect(m.version("v1")).toBe(a.id);
    expect(a.checksum).toBe(
      createHash("sha256").update(syntheticFile().buffer).digest("hex"),
    );
  });
  it.each([
    ["kind", "SOURCE"],
    ["state", "QUARANTINED"],
    ["storageKey", "guidance/../outside"],
    ["storageKey", `guidance/${ids.lecturer}`],
    ["mimeType", "text/plain"],
    ["checksum", "invalid"],
    ["sizeBytes", 0],
    ["createdByUserId", ids.outsider],
  ] as [keyof FileAsset, string | number][])(
    "rejects invalid final claim %s=%s",
    (key, value) => {
      const m = finalAssetIntegrityModel(),
        a = { ...syntheticAsset(), [key]: value };
      m.add(a);
      expect(() =>
        m.transaction(() => m.final(a.id, ids.student, "v1")),
      ).toThrow("FINAL_ASSET_INVALID");
      expect(m.version("v1")).toBeUndefined();
    },
  );
  it.each([
    ["id", ids.outsider],
    ["kind", "SOURCE"],
    ["state", "QUARANTINED"],
    ["storageKey", `guidance/${ids.outsider}`],
    ["originalName", "changed.pdf"],
    ["sizeBytes", 1],
    ["mimeType", "text/plain"],
    ["checksum", "f".repeat(64)],
    ["createdByUserId", ids.outsider],
    ["createdAt", new Date("2031-01-01")],
    ["updatedAt", new Date("2031-01-01")],
  ] as [keyof FileAsset, string | number | Date][])(
    "rejects final metadata mutation: %s",
    (key, value) => {
      const { m, a } = setup();
      m.final(a.id, ids.student, "v1");
      expect(() =>
        m.transaction(() => m.update(a.id, { [key]: value })),
      ).toThrow("FINAL_METADATA_IMMUTABLE");
      expect(m.get(a.id)).toEqual(a);
    },
  );
  it("rejects DELETE and duplicate final use while allowing exact metadata no-op", () => {
    const { m, a } = setup();
    m.final(a.id, ids.student, "v1");
    expect(() => m.transaction(() => m.delete(a.id))).toThrow(
      "FINAL_DELETE_FORBIDDEN",
    );
    expect(() => m.transaction(() => m.final(a.id, ids.student, "v2"))).toThrow(
      "FINAL_DUPLICATE",
    );
    m.update(a.id, { id: a.id });
    expect(m.get(a.id)).toEqual(a);
  });
  it("excludes weekly in both directions and preserves weekly metadata through rejected adoption", () => {
    const { m, a } = setup();
    m.weekly(a.id);
    const before = m.get(a.id);
    expect(() => m.transaction(() => m.final(a.id, ids.student, "v1"))).toThrow(
      "WEEKLY_ASSET",
    );
    expect(m.get(a.id)).toEqual(before);
    const other = {
      ...a,
      id: ids.lecturer,
      storageKey: `guidance/${ids.lecturer}`,
    };
    m.add(other);
    m.final(other.id, ids.student, "v2");
    expect(() => m.transaction(() => m.weekly(other.id))).toThrow(
      "FINAL_ASSET",
    );
    // The final guard adds no restriction for a weekly-only metadata update.
    // The real baseline step8b guard still independently applies to COMMITTED uploads.
    m.update(a.id, { state: "QUARANTINED" });
    expect(m.get(a.id).state).toBe("QUARANTINED");
  });
  it("allows pre-link staging READY, then rolls back failed finalization without fake provenance", () => {
    const m = finalAssetIntegrityModel(),
      a = { ...syntheticAsset(), state: "QUARANTINED" as const };
    m.add(a);
    expect(() =>
      m.transaction(() => {
        m.update(a.id, { state: "READY" });
        m.final(a.id, ids.student, "v1");
        throw Error("AUDIT_FAILURE_MODEL");
      }),
    ).toThrow("AUDIT_FAILURE_MODEL");
    expect(m.get(a.id)).toEqual(a);
    expect(m.version("v1")).toBeUndefined();
    m.transaction(() => {
      m.update(a.id, { state: "READY" });
      m.final(a.id, ids.student, "v1");
    });
    expect(m.version("v1")).toBe(a.id);
  });
  it.each(["weekly", "metadata", "delete", "final"] as const)(
    "simulates old-snapshot %s writer losing to a committed final claim",
    (writer) => {
      const { m, a } = setup(),
        snapshot = m.generation(a.id);
      m.final(a.id, ids.student, "winner");
      expect(() =>
        m.transaction(() => {
          if (writer === "weekly") m.weekly(a.id, snapshot);
          else if (writer === "metadata")
            m.update(a.id, { checksum: "f".repeat(64) }, snapshot);
          else if (writer === "delete") m.delete(a.id, snapshot);
          else m.final(a.id, ids.student, "loser", snapshot);
        }),
      ).toThrow("SERIALIZATION_CONFLICT_MODEL");
      expect(m.get(a.id)).toEqual(a);
      expect(m.version("winner")).toBe(a.id);
      expect(m.version("loser")).toBeUndefined();
    },
  );
  it("simulates weekly or metadata committing first, then revalidates after conflict", () => {
    for (const writer of ["weekly", "metadata"] as const) {
      const { m, a } = setup(),
        snapshot = m.generation(a.id);
      if (writer === "weekly") m.weekly(a.id);
      else m.update(a.id, { state: "QUARANTINED" });
      expect(() =>
        m.transaction(() => m.final(a.id, ids.student, "v1", snapshot)),
      ).toThrow("SERIALIZATION_CONFLICT_MODEL");
      expect(() =>
        m.transaction(() => m.final(a.id, ids.student, "v1")),
      ).toThrow(writer === "weekly" ? "WEEKLY_ASSET" : "FINAL_ASSET_INVALID");
    }
  });
});
describe("UC17 real service with isolated adapters — NOT database-backed", () => {
  it("creates a fresh backend-owned PDF and keeps an unrelated weekly synthetic asset intact", async () => {
    const f = createFinalDefenseFixture(),
      weekly = syntheticAsset();
    f.state.assets.set(weekly.id, structuredClone(weekly));
    const result = await f.service.upload(
      ids.student,
      ids.proposal,
      0,
      syntheticFile(),
      "fresh",
    );
    const version = f.state.report!.versions[0];
    expect(result?.revision).toBe(1);
    expect(version.fileAssetId).not.toBe(weekly.id);
    expect(version.fileAsset.storageKey).toBe(
      `guidance/${version.fileAssetId}`,
    );
    expect(version.fileAsset.createdByUserId).toBe(ids.student);
    expect(f.state.assets.get(weekly.id)).toEqual(weekly);
  });
});
