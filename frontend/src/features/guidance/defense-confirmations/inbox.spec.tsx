import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { InboxRows } from "./inbox";
import type { InboxResponse } from "./types";
describe("UC17 official inbox presentation", () => {
  it("links real dossiers and shows stale PDF/assignment without a progress hard gate", () => {
    const response = {
      view: "ADVISOR",
      items: [
        {
          termStudentId: "member",
          studentCode: "SV01",
          studentName: "Sinh viên",
          proposalId: "real-id",
          title: "Đồ án",
          status: "CONFIRMED",
          advisor: { state: "OFFICIAL" },
          pdfChangedSinceDecision: true,
          advisorChangedSinceDecision: true,
          progress: { summary: { completed: 0, total: 3, overdue: 2 } },
        },
      ],
    } as InboxResponse;
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <InboxRows response={response} />
      </MemoryRouter>,
    );
    expect(html).toContain("real-id");
    expect(html).toContain("PDF đã thay đổi");
    expect(html).toContain("Phân công đã thay đổi");
    expect(html).toContain("không tự chặn UC17");
    expect(html).not.toMatch(/DemoDb|storageKey|filePath/);
  });
  it("does not invent pending mock students in an empty official inbox", () => {
    const response = { view: "ADVISOR", items: [] } as unknown as InboxResponse;
    expect(renderToStaticMarkup(<InboxRows response={response} />)).toContain(
      "Không có hồ sơ trong phạm vi",
    );
  });
});
