import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup as render } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { FinalResultPage } from "./page";
import { finalResultKeys as keys } from "./api";
import { FinalResultQuerySchema } from "@doan/shared";
import { syntheticFinalResult } from "./final-result.fixture";
vi.mock("../../../shared/api/api-session", () => ({ AUTH_API: true }));
const auth = vi.hoisted(() => ({
  id: "actor",
  roles: ["FACULTY"],
  permissions: ["defense-result:read"],
}));
vi.mock("../../../shared/hooks/use-api-session", () => ({
  useApiSession: () => auth,
}));
function page(
  options: {
    loading?: boolean;
    status?: number;
    actor?: string;
    student?: boolean;
  } = {},
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
    actor = options.actor ?? auth.id,
    q = FinalResultQuerySchema.parse({ termId: "term" }),
    v = syntheticFinalResult();
  if (options.student) {
    v.visibility = "STUDENT";
    v.state = "PUBLISHED";
    v.sources = [];
  }
  if (!options.loading) {
    client.setQueryData(keys.options(actor), {
      terms: [
        { id: "term", code: "T", name: "Đợt kiểm thử", status: "DEFENDING" },
      ],
      committees: [],
    });
    client.setQueryData(keys.list(actor, q), {
      items: [v],
      total: 1,
      page: 1,
      limit: 20,
    });
    client.setQueryData(keys.detail(actor, "term", "student"), v);
  }
  if (options.status)
    client
      .getQueryCache()
      .build(client, { queryKey: keys.list(actor, q) })
      .setState({
        status: "error",
        error: {
          response: {
            status: options.status,
            data: { error: { message: `HTTP ${options.status}` } },
          },
        },
      } as never);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={["/defense/results?termId=term&termStudentId=student"]}
      >
        <FinalResultPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("UC24 API page SSR (no browser interaction claim)", () => {
  it("renders result list and details from API cache", () => {
    const s = page();
    expect(s).toContain("Sinh viên kiểm thử");
    expect(s).toContain("Khoa chốt và khóa");
    expect(s).toContain("Đợt kiểm thử");
  });
  it("loading has no fabricated score", () => {
    const s = page({ loading: true });
    expect(s).toContain("Đang tải");
    expect(s).not.toContain("8.4");
  });
  it("another actor's cache is never displayed", () => {
    const s = page({ actor: "other" });
    expect(s).not.toContain("Sinh viên kiểm thử");
    expect(s).not.toContain("8.4");
  });
  it.each([401, 403, 404, 409])("handles HTTP %s", (status) => {
    const s = page({ status });
    expect(s).toContain("Tải lại");
    expect(s).not.toContain("Thao tác đã được backend lưu thành công");
  });
  it("student sees published final score without command controls", () => {
    auth.roles = ["STUDENT"];
    try {
      const s = page({ student: true });
      expect(s).toContain("8.4");
      expect(s).not.toContain("Khoa chốt và khóa");
    } finally {
      auth.roles = ["FACULTY"];
    }
  });
  it("admin or missing read cannot enter workspace", () => {
    auth.roles = ["ADMIN"];
    try {
      expect(page()).toContain("chưa có quyền");
    } finally {
      auth.roles = ["FACULTY"];
    }
  });
});
