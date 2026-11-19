import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SchedulePage } from "./page";
import { syntheticWorkspace } from "./schedule.fixture";
vi.mock("../../../shared/api/api-session", () => ({ AUTH_API: true }));
const auth = vi.hoisted(() => ({ id: "faculty" }));
vi.mock("../../../shared/hooks/use-api-session", () => ({
  useApiSession: () => ({
    id: auth.id,
    roles: ["FACULTY"],
    permissions: ["defense-schedule:read"],
  }),
}));
function render(path: string, error = 0, loading = false, personal = false) {
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
    ["schedule-terms", "faculty"],
    [{ id: "term", code: "T", name: "Đợt bảo vệ", status: "IN_PROGRESS" }],
  );
  const w = syntheticWorkspace();
  if (personal) {
    w.mode = "PERSONAL";
    w.sources = [];
    w.rooms = [];
    w.policy = null;
    w.permissions = {
      create: false,
      update: false,
      finalize: false,
      publish: false,
    };
  }
  if (!loading)
    client.setQueryData(["schedule-workspace", "faculty", "term"], w);
  if (error)
    client
      .getQueryCache()
      .build(client, { queryKey: ["schedule-workspace", auth.id, "term"] })
      .setState({
        status: "error",
        error: Object.assign(Error("TEST_ONLY"), { status: error }),
        fetchStatus: "idle",
        data: undefined,
      });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SchedulePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
describe("UC21 routed page and cache isolation", () => {
  it("renders faculty period/committee/room/day/filter, detail and reload/create controls", () => {
    auth.id = "faculty";
    const html = render("/defense/schedule?termId=term&sessionId=session");
    for (const t of [
      "Đợt bảo vệ",
      "Sáng",
      "Chiều",
      "H1",
      "Phòng bảo vệ A",
      "Nguyễn Văn An",
      "Đề xuất lịch sáng/chiều",
      "Công bố lịch",
      "Tải lại lịch",
    ])
      expect(html).toContain(t);
    expect(html).not.toContain("Đã lưu thao tác lịch bảo vệ trên hệ thống.");
  });
  it("filters day/period/room/committee/student/state without changing cached source", () => {
    for (const q of [
      "date=2030-11-08",
      "period=AFTERNOON",
      "roomId=other",
      "committeeId=other",
      "search=missing",
      "state=FINALIZED",
    ])
      expect(render("/defense/schedule?termId=term&" + q)).toContain(
        "Không có lịch",
      );
  });
  it("does not reuse another actor or term data and shows loading/reload", () => {
    auth.id = "faculty";
    expect(render("/defense/schedule?termId=other")).not.toContain(
      "Nguyễn Văn An",
    );
    expect(render("/defense/schedule?termId=term", 0, true)).toContain(
      "Đang tải lịch",
    );
    auth.id = "other";
    expect(render("/defense/schedule?termId=term")).not.toContain(
      "Nguyễn Văn An",
    );
    auth.id = "faculty";
  });
  it.each([401, 403, 404, 409])(
    "shows HTTP %i/reload with no false success",
    (status) => {
      auth.id = "faculty";
      const html = render("/defense/schedule?termId=term", status);
      expect(html).toContain("Tải lại lịch");
      expect(html).not.toContain("Nguyễn Văn An");
      expect(html).not.toContain("Đã lưu thao tác lịch");
    },
  );
  it("personal mode only presents published schedules and read details", () => {
    const html = render(
      "/defense/schedule?termId=term&sessionId=session",
      0,
      false,
      true,
    );
    expect(html).toContain("Lịch cá nhân đã công bố");
    expect(html).not.toContain("Đề xuất lịch sáng/chiều");
    expect(html).not.toContain("Tạo lịch dự thảo");
    expect(html).not.toContain("Lý do chốt");
  });
});
