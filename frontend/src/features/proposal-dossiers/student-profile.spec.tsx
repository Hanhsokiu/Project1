import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { DossierView } from "@doan/shared";
import { DossierStudentProfile } from "./student-profile";

const dossier = {
  proposalId: "proposal-1",
  readiness: ["STUDENT_PROFILE_NOT_READY"],
  studentProfile: {
    className: null,
    majorName: null,
    revision: null,
    suggestedClassName: "CNTT K63",
    canManage: true,
  },
} as DossierView;

function render(value: DossierView) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <DossierStudentProfile dossier={value} onResult={() => {}} />
    </QueryClientProvider>,
  );
}

describe("Dossier academic print profile", () => {
  it("suggests the existing class and leaves major empty for faculty confirmation", () => {
    const html = render(dossier);
    expect(html).toContain('aria-label="Lớp phục vụ bản in"');
    expect(html).toContain('value="CNTT K63"');
    expect(html).toMatch(
      /aria-label="Ngành đào tạo phục vụ bản in"[^>]*value=""/,
    );
    expect(html).toContain("Lớp/ngành được gợi ý từ hồ sơ sinh viên");
    expect(html).toContain(
      "Tôi đã đối chiếu và xác nhận đúng lớp, ngành đào tạo",
    );
    expect(html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, "")).toMatch(
      /<button[^>]*disabled=""[^>]*>Xác nhận lớp\/ngành cho bản in/,
    );
    expect(html).not.toContain('checked=""');
  });

  it("uses confirmed profile values before class suggestions when editing", () => {
    const html = render({
      ...dossier,
      readiness: [],
      studentProfile: {
        ...dossier.studentProfile!,
        className: "Lớp đã đối chiếu",
        majorName: "Công nghệ thông tin",
        revision: 2,
      },
    });
    expect(html).toContain('value="Lớp đã đối chiếu"');
    expect(html).toContain('value="Công nghệ thông tin"');
    expect(html).not.toContain('value="CNTT K63"');
    expect(html).not.toContain("Lớp/ngành được gợi ý");
  });

  it("prefills an explicitly recorded student major while requiring faculty confirmation", () => {
    const html = render({
      ...dossier,
      studentProfile: {
        ...dossier.studentProfile!,
        suggestedMajorName: "Công nghệ thông tin",
      },
    });
    expect(html).toContain('value="Công nghệ thông tin"');
    expect(html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, "")).toMatch(
      /<button[^>]*disabled=""[^>]*>Xác nhận lớp\/ngành cho bản in/,
    );
    expect(html).not.toContain('checked=""');
  });

  it("shows waiting information to viewers without profile management permission", () => {
    const html = render({
      ...dossier,
      studentProfile: { ...dossier.studentProfile!, canManage: false },
    });
    expect(html).toContain("Đang chờ Khoa xác nhận lớp/ngành");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Xác nhận lớp/ngành cho bản in");
  });

  it("keeps finalized profiles read-only when the server disables management", () => {
    const html = render({
      ...dossier,
      state: "FINALIZED",
      readiness: [],
      studentProfile: {
        ...dossier.studentProfile!,
        className: "CNTT K63",
        majorName: "Công nghệ thông tin",
        revision: 0,
        canManage: false,
      },
    });
    expect(html).toContain("Ngành đào tạo: Công nghệ thông tin");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Đang chờ Khoa");
  });
});
