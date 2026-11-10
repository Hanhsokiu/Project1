import { describe, expect, it, vi } from "vitest";
import { FinalDefenseSession } from "./final-defense.repository";
import type { Prisma } from "@prisma/client";

describe("UC17 capability check before migration", () => {
  it("checks only catalogs and stops before any new-model lookup when columns are absent", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const s = new FinalDefenseSession({
      $queryRaw: query,
    } as unknown as Prisma.TransactionClient);
    expect(await s.schemaReady()).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("does not treat a partial column-only deployment as a safe applied migration", async () => {
    const columns = [
      "FINAL_REPORT.revision",
      "FINAL_REPORT_VERSION.id",
      "FINAL_REPORT_VERSION.report_id",
      "FINAL_REPORT_VERSION.sequence",
      "FINAL_REPORT_VERSION.file_asset_id",
      "FINAL_REPORT_VERSION.submitted_at",
      "DEFENSE_CONFIRMATION.revision",
      "DEFENSE_CONFIRMATION.report_version_id",
      "DEFENSE_CONFIRMATION.context",
      "SCORE_ENTRY.revision",
      "SCORE_ENTRY.report_version_id",
      "SCORE_ENTRY.comment",
      "SCORE_ENTRY.context",
    ].map((n) => {
      const [table_name, column_name] = n.split(".");
      return { table_name, column_name };
    });
    const query = vi
      .fn()
      .mockResolvedValueOnce(columns)
      .mockResolvedValueOnce([]);
    expect(
      await new FinalDefenseSession({
        $queryRaw: query,
      } as unknown as Prisma.TransactionClient).schemaReady(),
    ).toBe(false);
  });
  it("refuses the old guard set until the FILE_ASSET immutability trigger is deployed", async () => {
    const columns = [
      "FINAL_REPORT.revision",
      "FINAL_REPORT_VERSION.id",
      "FINAL_REPORT_VERSION.report_id",
      "FINAL_REPORT_VERSION.sequence",
      "FINAL_REPORT_VERSION.file_asset_id",
      "FINAL_REPORT_VERSION.submitted_at",
      "DEFENSE_CONFIRMATION.revision",
      "DEFENSE_CONFIRMATION.report_version_id",
      "DEFENSE_CONFIRMATION.context",
      "SCORE_ENTRY.revision",
      "SCORE_ENTRY.report_version_id",
      "SCORE_ENTRY.comment",
      "SCORE_ENTRY.context",
    ].map((n) => {
      const [table_name, column_name] = n.split(".");
      return { table_name, column_name };
    });
    const guards = [
      "final_confirmation_version_fk",
      "advisor_score_version_fk",
      "final_report_revision_nonnegative",
      "final_confirmation_valid",
      "final_advisor_score_valid",
      "final_pdf_immutable",
      "final_pdf_asset_check",
      "final_confirmation_owner",
      "advisor_score_owner",
      "final_pdf_no_weekly_submission",
      "final_pdf_no_weekly_upload",
    ].map((name) => ({ name }));
    const query = vi
      .fn()
      .mockResolvedValueOnce(columns)
      .mockResolvedValueOnce(guards);
    const s = new FinalDefenseSession({
      $queryRaw: query,
    } as unknown as Prisma.TransactionClient);
    expect(await s.schemaReady()).toBe(false);
    query
      .mockResolvedValueOnce(columns)
      .mockResolvedValueOnce([
        ...guards,
        { name: "final_pdf_asset_immutable" },
      ]);
    expect(await s.schemaReady()).toBe(true);
    // Static query contract: a matching trigger name on the wrong relation,
    // function, event or disabled/replica-only trigger must not count.
    const text = query.mock.calls[1][0].join("");
    expect(text).toContain("pn.nspname='public'");
    expect(text).toContain("NOT t.tgisinternal");
    expect(text).toContain("t.tgenabled IN ('O','A')");
    expect(text).toContain(
      "('FILE_ASSET','final_pdf_asset_immutable','final_pdf_asset_immutable',27)",
    );
  });
});
