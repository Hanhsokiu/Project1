import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { EligibilityPage } from "./page";
import type { EligibilityView } from "@doan/shared";
vi.mock("../../../shared/api/api-session", () => ({ AUTH_API: true }));
vi.mock("../../../shared/hooks/use-api-session", () => ({
  useApiSession: () => ({
    id: "faculty",
    roles: ["FACULTY"],
    permissions: ["defense-eligibility:read"],
  }),
}));
const view: EligibilityView = {
  termId: "term",
  termStudentId: "member",
  proposalId: "proposal",
  studentCode: "SYNTHETIC01",
  studentName: "Sinh viên tổng hợp",
  title: "Đề tài tổng hợp",
  advisor: null,
  revision: 0,
  evidenceHash: "f".repeat(64),
  preview: "MISSING",
  uc17: "MISSING",
  pdf: "UNVERIFIED",
  policy: null,
  checks: [{ key: "pdf", state: "MISSING", message: "Thiếu PDF cuối" }],
  official: { state: "NONE", status: "PENDING" },
  academic: null,
  advisorSummary: null,
  history: [],
  downstream: null,
  actionBlockers: {
    review: ["UC18_NOT_ENABLED"],
    decide: ["CURRENT_REVIEW_REQUIRED"],
    finalize: ["VERIFIED_QUALIFIED_EVIDENCE_REQUIRED"],
  },
};
function render(
  path: string,
  { empty = false, error = 0, loading = false } = {},
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
  });
  client.setQueryData(
    ["eligibility-terms", "faculty"],
    [{ id: "term", code: "T", name: "Đợt tổng hợp", status: "IN_PROGRESS" }],
  );
  const params = new URLSearchParams(path.split("?")[1]);
  const query = {
    termId: params.get("termId") ?? "",
    page: 1,
    limit: 20,
    search: params.get("search") ?? "",
    preview: params.get("preview") || undefined,
    official: undefined,
  };
  if (!loading && !error)
    client.setQueryData(["eligibility-list", "faculty", query], {
      items: empty ? [] : [view],
      total: empty ? 0 : 1,
      page: 1,
      limit: 20,
    });
  client.setQueryData(
    ["eligibility-detail", "faculty", "term", "member"],
    view,
  );
  if (error) {
    const q = client
      .getQueryCache()
      .build(client, { queryKey: ["eligibility-list", "faculty", query] });
    q.setState({
      status: "error",
      error: Object.assign(new Error("Synthetic error"), { status: error }),
      fetchStatus: "idle",
    });
  }
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <EligibilityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
describe("UC18 page wired to term-scoped React Query and router state", () => {
  it("renders selected term, filtered list and detail using the same server projection", () => {
    const html = render(
      "/defense/eligibility?termId=term&termStudentId=member&search=SYNTHETIC01&preview=MISSING",
    );
    expect(html).toContain("SYNTHETIC01");
    expect(html).toContain("Thiếu PDF cuối");
    expect(html).toContain('value="term" selected');
    expect(html).toContain('value="SYNTHETIC01"');
    expect(html).toContain('value="MISSING" selected');
    expect(html).toContain("Khoa chưa xét");
    expect(html).toContain("Nhóm chưa bật ghi UC18");
    expect(html).not.toContain("Hồ sơ đã chốt và chứng cứ");
  });
  it("does not reuse another term's detail, and handles empty/loading states", () => {
    expect(
      render("/defense/eligibility?termId=other&termStudentId=member"),
    ).not.toContain("Thiếu PDF cuối");
    expect(
      render("/defense/eligibility?termId=term", { empty: true }),
    ).toContain("Không có hồ sơ trong phạm vi/bộ lọc");
    expect(
      render("/defense/eligibility?termId=term", { loading: true }),
    ).toContain("Đang tải hồ sơ");
  });
  it.each([401, 403, 404, 409])(
    "renders HTTP %i errors without approval or success claims",
    (error) => {
      const html = render("/defense/eligibility?termId=term", { error });
      expect(html).toContain("Synthetic error");
      expect(html).not.toContain("Đã lưu thao tác");
      expect(html).not.toContain("Hồ sơ đã chốt và chứng cứ");
    },
  );
});
