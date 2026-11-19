import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CommitteePage } from "./page";
import type { CommitteeWorkspace } from "@doan/shared";
vi.mock("../../../shared/api/api-session", () => ({ AUTH_API: true }));
const auth = vi.hoisted(() => ({ id: "faculty" }));
vi.mock("../../../shared/hooks/use-api-session", () => ({
  useApiSession: () => ({
    id: auth.id,
    roles: ["FACULTY"],
    permissions: ["defense-committee:read"],
  }),
}));
const w: CommitteeWorkspace = {
  termId: "term",
  rosterHash: "f".repeat(64),
  policy: null,
  schemaReady: false,
  blockers: ["UC19_SCHEMA_REQUIRED"],
  departments: [],
  lecturers: [],
  candidates: [],
  committees: [
    {
      id: "c",
      termId: "term",
      code: "H1",
      name: "Hội đồng riêng của kỳ",
      departmentId: "d",
      revision: 2,
      state: "DRAFT",
      members: [],
      students: [],
      issues: ["COMMITTEE_SIZE_3_TO_5"],
      blockers: {
        update: ["UC19_SCHEMA_REQUIRED"],
        assign: ["UC19_SCHEMA_REQUIRED"],
        finalize: ["COMMITTEE_SIZE_3_TO_5"],
      },
      history: [],
      downstream: null,
    },
  ],
  permissions: { create: false, update: false, assign: false, finalize: false },
};
function render(path: string, error = 0, loading = false) {
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
    ["committee-terms", "faculty"],
    [{ id: "term", code: "T", name: "Đợt tổng hợp", status: "IN_PROGRESS" }],
  );
  if (!loading)
    client.setQueryData(["committee-workspace", "faculty", "term"], w);
  if (error)
    client
      .getQueryCache()
      .build(client, { queryKey: ["committee-workspace", auth.id, "term"] })
      .setState({
        status: "error",
        error: Object.assign(new Error("Synthetic HTTP error"), {
          status: error,
        }),
        fetchStatus: "idle",
        data: undefined,
      });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <CommitteePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
describe("UC19 routed page/cache isolation", () => {
  it("renders selected term, search, detail, empty candidates and schema blockers", () => {
    const html = render(
      "/defense/committees?termId=term&committeeId=c&search=H1",
    );
    expect(html).toContain("Hội đồng riêng của kỳ");
    expect(html).toContain('value="term" selected');
    expect(html).toContain('value="H1"');
    expect(html).toContain("Không có hồ sơ UC18 trong phạm vi");
    expect(html).toContain("Cần migration UC19");
  });
  it("does not reuse committee data across terms or actors, and supports loading", () => {
    expect(render("/defense/committees?termId=other")).not.toContain(
      "Hội đồng riêng của kỳ",
    );
    auth.id = "other-user";
    try {
      expect(render("/defense/committees?termId=term")).not.toContain(
        "Hội đồng riêng của kỳ",
      );
    } finally {
      auth.id = "faculty";
    }
    expect(render("/defense/committees?termId=term", 0, true)).toContain(
      "Đang tải hội đồng",
    );
  });
  it.each([401, 403, 404, 409])(
    "shows HTTP %i without a fake saved/finalized message",
    (error) => {
      const html = render("/defense/committees?termId=term", error);
      expect(html).toContain("Synthetic HTTP error");
      expect(html).not.toContain("Đã lưu thao tác hội đồng");
      expect(html).not.toContain("Hội đồng đã chốt, nguồn còn hiệu lực");
    },
  );
});
