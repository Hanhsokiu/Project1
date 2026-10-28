import { describe, expect, it, vi } from "vitest";
import { finalReportContextSchema, finalReportSchema } from "./contracts";
import {
  reportsMatch,
  uploadBlockers,
  uploadContextKey,
  validateFinalReportFile,
} from "./validation";
import { contextFixture, pdfFixture, reportFixture } from "./test-fixtures";

describe("final PDF context/revision and independent submission window", () => {
  it.each([0, 1, 8])("accepts initial/replacement revision %i", (revision) => {
    expect(
      uploadBlockers(contextFixture(revision), reportFixture(revision)),
    ).toEqual([]);
  });
  it("does not block reupload after UC17 CONFIRMED or inherit a locked FINAL phase", () => {
    const c = Object.assign(contextFixture(1), {
      uc17: { status: "CONFIRMED" },
      finalPhase: { locked: true },
    });
    expect(uploadBlockers(c, reportFixture(1))).toEqual([]);
  });
  it.each([
    ["missing", "FINAL_REPORT_WINDOW_NOT_CONFIGURED"],
    ["locked", "FINAL_REPORT_WINDOW_LOCKED"],
    ["closed", "FINAL_REPORT_WINDOW_CLOSED"],
    ["future", "FINAL_REPORT_WINDOW_NOT_OPEN"],
  ])("blocks %s window without inferring a default", (state, code) => {
    const c = contextFixture();
    c.canSubmit = false;
    c.readiness = [code];
    if (state === "missing") c.window = null;
    if (state === "locked") c.window!.locked = true;
    if (state === "closed") c.serverNow = c.window!.closesAt;
    if (state === "future") c.serverNow = "2026-09-01T00:00:00.000Z";
    expect(uploadBlockers(c, reportFixture()).length).toBeGreaterThan(0);
  });
  it("uses serverNow instead of local clock and treats closesAt as exclusive", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01"));
    try {
      const c = contextFixture();
      c.serverNow = c.window!.opensAt;
      expect(uploadBlockers(c, reportFixture())).toEqual([]);
      c.serverNow = c.window!.closesAt;
      expect(uploadBlockers(c, reportFixture()).join(" ")).toContain("hết hạn");
    } finally {
      vi.useRealTimers();
    }
  });
  it("blocks inconsistent window data even if canSubmit is incorrectly true", () => {
    const c = contextFixture();
    c.window!.closesAt = c.window!.opensAt;
    expect(uploadBlockers(c, reportFixture())).not.toEqual([]);
  });
  it("honors backend ownership/permission readiness even while the window is open", () => {
    const c = contextFixture();
    c.canSubmit = false;
    c.readiness = ["FINAL_REPORT_FORBIDDEN"];
    expect(uploadBlockers(c, reportFixture()).join(" ")).toContain("quyền");
  });
  it("detects two GETs observing different revisions or different file evidence", () => {
    expect(reportsMatch(contextFixture(), reportFixture(1))).toBe(false);
    const c = contextFixture(1),
      report = reportFixture(1);
    if (report.state === "SUBMITTED") report.file.checksum = "c".repeat(64);
    expect(uploadBlockers(c, report).join(" ")).toContain("tải lại");
    expect(reportsMatch(c, { ...report, proposalId: "other" })).toBe(false);
  });
  it("keeps a legacy record distinct and allows replacement when server permits it", () => {
    const c = contextFixture();
    c.report = {
      ...reportFixture(),
      state: "LEGACY_REQUIRES_RECONCILIATION",
      file: null,
    };
    expect(uploadBlockers(c, c.report)).toEqual([]);
    expect(finalReportSchema.parse(c.report).state).toBe(
      "LEGACY_REQUIRES_RECONCILIATION",
    );
  });
  it("does not manufacture missing limits/context and strips unexpected storage properties", () => {
    const c = contextFixture();
    expect(
      finalReportContextSchema.safeParse({ ...c, maxFileBytes: undefined })
        .success,
    ).toBe(false);
    expect(
      finalReportContextSchema.safeParse({ ...c, code: "FINAL" }).success,
    ).toBe(false);
    const parsed = finalReportSchema.parse({
      ...reportFixture(1),
      storageKey: "private-key",
      filePath: "private-path",
    });
    expect(parsed).not.toHaveProperty("storageKey");
    expect(parsed).not.toHaveProperty("filePath");
  });
  it("resets file selection key when revision or window changes", () => {
    const c = contextFixture(),
      key = uploadContextKey(c);
    c.expectedRevision++;
    expect(uploadContextKey(c)).not.toBe(key);
    c.expectedRevision--;
    c.window!.revision++;
    expect(uploadContextKey(c)).not.toBe(key);
  });
});

describe("final PDF preliminary file validation", () => {
  it("accepts a PDF envelope with safe Unicode name and backend-defined size limit", async () => {
    const f = pdfFixture("BÁO CÁO.PDF");
    await expect(
      validateFinalReportFile(f, {
        maxFileBytes: f.size,
        allowedExtensions: ["pdf"],
      }),
    ).resolves.toBeUndefined();
  });
  it.each([
    ["a.txt", "text/plain"],
    ["a.pdf", "application/octet-stream"],
    ["a.pdf", ""],
    ["a.exe", "application/pdf"],
  ])("rejects extension/MIME mismatch %s %s", async (name, mime) => {
    await expect(
      validateFinalReportFile(
        pdfFixture(name, undefined, mime),
        contextFixture(),
      ),
    ).rejects.toThrow("Chỉ nhận");
  });
  it.each([
    "../report.pdf",
    "a/b.pdf",
    "con.pdf",
    "bad\r\n.pdf",
    "bad?.pdf",
    "a\u202eb.pdf",
    " spaced.pdf",
    "a.pdf ",
  ])("rejects unsafe filename %s", async (name) => {
    await expect(
      validateFinalReportFile(pdfFixture(name), contextFixture()),
    ).rejects.toThrow("Tên file");
  });
  it.each(["", "x".repeat(181) + ".pdf"])(
    "rejects empty/oversized names",
    async (name) => {
      await expect(
        validateFinalReportFile(pdfFixture(name), contextFixture()),
      ).rejects.toThrow("Tên file");
    },
  );
  it("rejects empty and oversized files before reading their contents", async () => {
    await expect(
      validateFinalReportFile(pdfFixture("empty.pdf", ""), contextFixture()),
    ).rejects.toThrow("rỗng");
    const file = pdfFixture(),
      slice = vi.spyOn(file, "slice");
    await expect(
      validateFinalReportFile(file, {
        maxFileBytes: file.size - 1,
        allowedExtensions: ["pdf"],
      }),
    ).rejects.toThrow("dung lượng");
    expect(slice).not.toHaveBeenCalled();
  });
  it.each([
    "not a PDF",
    "%PDF-1.7\nmissing trailer",
    "%PDF-1.9\nstartxref\n0\n%%EOF\n",
  ])("rejects fake or incomplete PDF content", async (body) => {
    await expect(
      validateFinalReportFile(pdfFixture("fake.pdf", body), contextFixture()),
    ).rejects.toThrow("cấu trúc PDF");
  });
  it("never silently uses a fixed/demo size limit when policy is missing", async () => {
    await expect(
      validateFinalReportFile(pdfFixture(), {
        maxFileBytes: NaN,
        allowedExtensions: ["pdf"],
      }),
    ).rejects.toThrow("cấu hình");
    await expect(
      validateFinalReportFile(pdfFixture(), {
        maxFileBytes: 1000,
        allowedExtensions: [],
      }),
    ).rejects.toThrow("cấu hình");
  });
});
