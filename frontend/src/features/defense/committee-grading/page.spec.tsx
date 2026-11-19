import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CommitteeGradePage } from "./page";
import { committeeGradeKeys as keys } from "./api";
import { CommitteeGradeQuerySchema } from "@doan/shared";
import { syntheticCommitteeGrade } from "./committee-grade.fixture";
vi.mock("../../../shared/api/api-session", () => ({ AUTH_API: true }));
const auth = vi.hoisted(() => ({
  id: "member1",
  roles: ["LECTURER"],
  permissions: ["defense-committee-grade:read"],
}));
vi.mock("../../../shared/hooks/use-api-session", () => ({
  useApiSession: () => auth,
}));
function render(
  path = "/defense/committee-grading?termId=term&committeeId=committee&termStudentId=student&lecturerId=l1",
  status = 0,
) {
  const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          retryOnMount: false,
          refetchOnMount: false,
          staleTime: Infinity,
        },
      },
    }),
    q = CommitteeGradeQuerySchema.parse({
      termId: "term",
      committeeId: "committee",
    }),
    v = syntheticCommitteeGrade();
  client.setQueryData(keys.options("member1"), {
    terms: [{ id: "term", code: "T", name: "Đợt bảo vệ", status: "DEFENDING" }],
    committees: [
      {
        termId: "term",
        id: "committee",
        code: "H1",
        name: "Hội đồng riêng",
        role: "CHAIR",
      },
    ],
  });
  client.setQueryData(keys.list("member1", q), {
    items: [v],
    total: 1,
    page: 1,
    limit: 20,
    blockers: [],
  });
  client.setQueryData(
    keys.detail("member1", "term", "committee", "student", "l1"),
    v,
  );
  if (status)
    client
      .getQueryCache()
      .build(client, { queryKey: keys.list(auth.id, q) })
      .setState({
        status: "error",
        error: Object.assign(new Error("TEST_ONLY HTTP"), { status }),
        fetchStatus: "idle",
        data: undefined,
      });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <CommitteeGradePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
describe("UC23 page actor/committee/student isolation and error states (SSR)", () => {
  it("shows committee/role/assigned student/rubric/total and reload without fake success", () => {
    auth.id = "member1";
    const html = render();
    for (const t of [
      "Đợt bảo vệ",
      "Hội đồng riêng",
      "Chủ tịch",
      "Sinh viên thuộc hội đồng",
      "Tải lại dữ liệu",
      "Điểm phiếu tạm tính",
    ])
      expect(html).toContain(t);
    expect(html).not.toContain("Đã lưu phiếu hội đồng trên hệ thống.");
  });
  it("never reuses data of another actor, term, committee or lecturer", () => {
    auth.id = "other";
    expect(render()).not.toContain("Sinh viên thuộc hội đồng");
    auth.id = "member1";
    expect(
      render("/defense/committee-grading?termId=other&committeeId=committee"),
    ).not.toContain("Sinh viên thuộc hội đồng");
    expect(
      render("/defense/committee-grading?termId=term&committeeId=other"),
    ).toContain("Đang tải phiếu hội đồng");
    expect(
      render(
        "/defense/committee-grading?termId=term&committeeId=committee&termStudentId=student&lecturerId=l2",
      ),
    ).not.toContain("TEST_ONLY nhận xét riêng");
  });
  it.each([401, 403, 404, 409])("shows HTTP %i with reload", (status) => {
    auth.id = "member1";
    expect(render(undefined, status)).toContain("TEST_ONLY HTTP");
  });
  it("student cannot render cached grading contents despite an accidental flat permission", () => {
    auth.roles = ["STUDENT"];
    expect(render()).toContain("Không có quyền xem/chấm hội đồng");
    expect(render()).not.toContain("Sinh viên thuộc hội đồng");
    auth.roles = ["LECTURER"];
  });
});
