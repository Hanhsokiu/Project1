import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { readFixture } from "./defense-confirmation-read.test-fixtures";
import {
  defenseConfirmationHistoryQuerySchema,
  defenseConfirmationPutSchema,
} from "./defense-confirmation.dto";
import {
  confirmationContextDto,
  confirmationDecisionDto,
  confirmationHistoryItem,
} from "./defense-confirmation-read.dto";
import type { DefenseConfirmationHistoryRecord } from "./defense-confirmation.repository";

describe("UC17 read DTOs and write expectation contract", () => {
  it("serializes exact PUT assertions without extra snapshot properties", async () => {
    const f = readFixture(),
      c = await f.read.context("advisor-user", "proposal");
    expect(
      defenseConfirmationPutSchema.safeParse({
        status: "CONFIRMED",
        expectedRevision: c.expectedRevision,
        expectedContext: c.expectedContext,
      }).success,
    ).toBe(true);
    expect(c.expectedContext!.pdf).not.toHaveProperty("originalName");
    expect(c.expectedContext!.pdf).not.toHaveProperty("submittedAt");
  });
  it("returns null expectations for an unavailable assignment or exhausted revision", async () => {
    const f = readFixture(),
      c = await f.contexts.read("advisor-user", "proposal");
    c.decision.revision = 2147483647;
    const exhausted = confirmationContextDto(c, true);
    expect(exhausted.expectedRevision).toBeNull();
    expect(exhausted.expectedContext).toBeNull();
    expect(exhausted.readiness.confirm.allowed).toBe(false);
    c.decision.revision = 0;
    c.advisor = { state: "NOT_READY", issues: [] };
    expect(confirmationContextDto(c, true).expectedContext).toBeNull();
  });
  it("preserves null actor names instead of substituting another actor", async () => {
    const f = readFixture();
    await f.service.put("advisor-user", "proposal", f.input());
    const row = await f.readRepo.read((s) => s.decisionRecord("proposal"));
    row!.decidedBy!.displayName = null;
    const dto = confirmationDecisionDto(
      "proposal",
      row,
      f.validator.decision(row, f.state.now),
      "STUDENT",
    );
    expect(dto.decision.decidedBy).toEqual({ displayName: null });
  });
  it("history mapper exposes only safe metadata even when raw JSON has private extra fields", () => {
    const f = readFixture();
    const row = {
      id: "history",
      revision: 1,
      status: "CONFIRMED",
      note: "ok",
      changeReason: null,
      decidedAt: f.state.now,
      actor: { id: "user", displayName: "GVHD" },
      advisor: { id: "advisor", fullName: "GVHD" },
      decisionContext: {
        ...f.facts.snapshot,
        storageKey: "secret",
        filePath: "secret",
        students: [{ id: "other-student" }],
      },
    } as unknown as DefenseConfirmationHistoryRecord;
    expect(JSON.stringify(confirmationHistoryItem(row))).not.toMatch(
      /secret|storageKey|filePath|checksum|originalName|other-student/,
    );
    row.decisionContext = { schemaVersion: 99 };
    expect(confirmationHistoryItem(row)).toMatchObject({
      snapshotSchemaVersion: null,
      pdfRevision: null,
    });
  });
  it("history pagination defaults to a bounded page and accepts decimal integer cursors only", () => {
    expect(defenseConfirmationHistoryQuerySchema.parse({})).toEqual({
      limit: 50,
    });
    expect(
      defenseConfirmationHistoryQuerySchema.parse({
        limit: "20",
        afterRevision: "2",
      }),
    ).toEqual({ limit: 20, afterRevision: 2 });
    for (const query of [
      { limit: "0" },
      { limit: 101 },
      { afterRevision: -1 },
      { afterRevision: "1.5" },
      { afterRevision: "1e2" },
      { actorId: "spoofed" },
    ])
      expect(
        defenseConfirmationHistoryQuerySchema.safeParse(query).success,
      ).toBe(false);
  });
});
