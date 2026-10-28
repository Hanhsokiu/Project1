import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SubmissionHistoryItem, validateSubmissionSelection } from "./pages";
import type { SubmissionUploadPolicy, TaskSubmissionView } from "@doan/shared";
const p = {
  maxFileBytes: 20,
  maxSubmissionBytes: 50,
  roles: {
    REPORT: { extensions: ["pdf"], maxFiles: 1 },
    SOURCE: { extensions: ["zip"], maxFiles: 1 },
    EVIDENCE: { extensions: ["png"], maxFiles: 3 },
  },
} as SubmissionUploadPolicy;
const files = [
  {
    kind: "REPORT" as const,
    file: { name: "r.pdf", size: 10, type: "application/pdf" },
  },
  {
    kind: "SOURCE" as const,
    file: { name: "s.zip", size: 20, type: "application/zip" },
  },
];
describe("8B frontend validation/history", () => {
  it("requires report and source, rejects oversize/invalid extension before upload", () => {
    expect(validateSubmissionSelection(files, p)).toBe(null);
    expect(validateSubmissionSelection(files.slice(0, 1), p)).toBeTruthy();
    expect(
      validateSubmissionSelection(
        [{ ...files[0], file: { ...files[0].file, size: 21 } }, files[1]],
        p,
      ),
    ).toContain("dung lượng");
    expect(
      validateSubmissionSelection(
        [{ ...files[0], file: { ...files[0].file, name: "r.exe" } }, files[1]],
        p,
      ),
    ).toContain("Định dạng");
  });
  it("renders immutable historical version/late flag without completion or public URLs", () => {
    const s = {
      id: "s",
      taskId: "t",
      versionNumber: 1,
      state: "SUPERSEDED",
      submittedBy: "owner",
      submittedAt: "2026-10-22T01:00:00Z",
      deadlineSnapshot: "2026-10-21T01:00:00Z",
      isLate: true,
      revision: 1,
      content: "Bản cũ",
      files: [
        {
          id: "f",
          kind: "REPORT",
          originalName: "Báo cáo.pdf",
          sizeBytes: 100,
          mimeType: "application/pdf",
          checksum: "hash",
        },
      ],
      contextSnapshot: {},
    } as TaskSubmissionView;
    const html = renderToStaticMarkup(
      <SubmissionHistoryItem
        submission={s}
        currentId="v2"
        onDownload={() => {}}
      />,
    );
    expect(html).toContain("Lần nộp");
    expect(html).toContain("Đã có bản nộp mới");
    expect(html).toContain("Nộp trễ");
    expect(html).toContain("Bản cũ");
    expect(html).not.toContain("/uploads");
    expect(html).not.toContain("COMPLETED");
    expect(html).not.toContain("href=");
  });
});
