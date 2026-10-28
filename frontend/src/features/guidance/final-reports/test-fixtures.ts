import type { FinalReport, FinalReportContext } from "./contracts";

/** Unit fixtures held in memory only. No DB records, files or accounts created. */
export function reportFixture(revision = 0): FinalReport {
  return revision === 0
    ? {
        proposalId: "proposal-pdf",
        revision,
        state: "NOT_SUBMITTED",
        submittedAt: null,
        file: null,
      }
    : {
        proposalId: "proposal-pdf",
        revision,
        state: "SUBMITTED",
        submittedAt: "2026-10-27T01:00:00.000Z",
        file: {
          originalName: "Đồ án.pdf",
          sizeBytes: 100,
          mimeType: "application/pdf",
          checksum: "b".repeat(64),
        },
      };
}
export function contextFixture(revision = 0): FinalReportContext {
  return {
    proposalId: "proposal-pdf",
    termId: "term-pdf",
    code: "FINAL_REPORT_SUBMISSION",
    canSubmit: true,
    readiness: [],
    serverNow: "2026-10-27T03:00:00.000Z",
    expectedRevision: revision,
    window: {
      opensAt: "2026-10-01T00:00:00.000Z",
      closesAt: "2026-11-01T00:00:00.000Z",
      locked: false,
      revision: 2,
    },
    maxFileBytes: 20 * 1024 * 1024,
    allowedExtensions: ["pdf"],
    temporarySizeLimit: true,
    report: reportFixture(revision),
  };
}
export function pdfFixture(
  name = "Đồ án.pdf",
  body = "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF\n",
  type = "application/pdf",
): File {
  return new File([body], name, { type });
}
