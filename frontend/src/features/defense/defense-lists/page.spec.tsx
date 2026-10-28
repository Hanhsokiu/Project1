import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PreviewRows } from "./page";
import type { Preview } from "./api";
describe("UC18 readonly preview", () => {
  it("shows missing dossiers, explicit blocking reasons and department-only coverage", () => {
    const preview = {
      scope: "DEPARTMENTS",
      rosterCount: 1,
      admittedCount: 0,
      rosterCompleteForTerm: false,
      notice: "Preview chưa chính thức",
      blockers: [{ code: "academic", message: "Chưa có nguồn học vụ" }],
      items: [
        {
          termStudentId: "member",
          studentCode: "SV_REAL",
          studentName: "Sinh viên thật",
          title: null,
          proposalId: null,
          evidence: {
            result: "WAITING_ADVISOR",
            officialEligibility: "UNKNOWN",
            reasons: [
              "PROPOSAL_MISSING",
              "PDF_MISSING",
              "ACADEMIC_SOURCE_NOT_VERIFIED",
            ],
          },
        },
      ],
    } as Preview;
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PreviewRows preview={preview} />
      </MemoryRouter>,
    );
    expect(html).toContain("SV_REAL");
    expect(html).toContain("không phải danh sách toàn đợt");
    expect(html).toContain("Thiếu hồ sơ Proposal");
    expect(html).toContain("Chưa nộp PDF");
    expect(html).toContain("UNKNOWN");
    expect(html).not.toMatch(/storageKey|filePath|checksum/);
  });
  it("renders empty scope rather than inventing eligible students", () => {
    const preview = {
      scope: "TERM",
      rosterCount: 0,
      admittedCount: 0,
      rosterCompleteForTerm: true,
      notice: "Preview",
      blockers: [],
      items: [],
    } as unknown as Preview;
    expect(renderToStaticMarkup(<PreviewRows preview={preview} />)).toContain(
      "Không có sinh viên trong bộ lọc",
    );
  });
});
