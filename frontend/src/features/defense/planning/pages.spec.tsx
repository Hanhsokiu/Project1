import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout, { PlanningSource } from "./layout";
import { CommitteePlanningPage, PreviewResult } from "./pages";
import { planningContextFixture, previewFixture } from "./test-fixtures";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/http-client", () => ({
  httpClient: { get: mocks.get, post: mocks.post },
}));
vi.mock("../../../shared/api/api-session", () => ({
  getApiUser: () => ({ id: "faculty", roles: ["FACULTY"] }),
  getAccessToken: () => "unit-token",
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_DEFENSE_PLANNING_API", "true");
  vi.stubEnv("VITE_AUTH_API", "true");
});
afterEach(() => vi.unstubAllEnvs());
describe("UC19–21 source/result UI and read-only initial state", () => {
  it("labels OPEN as roster simulation, never an admitted official list", () => {
    const html = renderToStaticMarkup(
      <PlanningSource context={planningContextFixture()} />,
    );
    expect(html).toContain("UC18 chưa FINALIZED");
    expect(html).toContain("chỉ là roster");
    expect(html).toContain("SV_API");
    expect(html).toContain("GVHD hiện hành");
    expect(html).not.toMatch(/storageKey|filePath|checksum/);
  });
  it("a historical finalized source with stale current evidence is not shown as OPEN", () => {
    const c = planningContextFixture();
    c.uc18.state = "FINALIZED";
    c.source.kind = "UC18_FINALIZED";
    c.students[0].evidence = "STALE";
    const html = renderToStaticMarkup(<PlanningSource context={c} />);
    expect(html).toContain("bản chốt UC18 đã xác minh");
    expect(html).toContain("STALE");
    expect(html).not.toContain("UC18 chưa FINALIZED");
  });
  it("preview success does not pretend to save or publish anything", () => {
    const html = renderToStaticMarkup(
      <PreviewResult result={previewFixture()} />,
    );
    expect(html).toContain("preview chưa lưu");
    expect(html).toContain("không phải xác nhận đủ điều kiện chốt/công bố");
    expect(html).toContain("Không gửi thông báo");
  });
  it("shows backend conflict explanations rather than a fake successful assignment", () => {
    const r = previewFixture();
    r.validForPreview = false;
    r.issues = [
      {
        code: "ADVISOR_REVIEWER_CONFLICT",
        message: "GVHD không được phản biện sinh viên mình hướng dẫn.",
      },
    ];
    expect(renderToStaticMarkup(<PreviewResult result={r} />)).toContain(
      "GVHD không được phản biện",
    );
  });
  it("read-only faculty can see legacy lists/detail access without preview permission", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const c = planningContextFixture();
    c.capabilities.canPreview = false;
    client.setQueryData(["defense-planning-terms", "faculty:unit-token"], {
      items: [{ id: "term", name: "Đợt thật" }],
    });
    client.setQueryData(
      ["defense-planning-context", "faculty:unit-token", "term"],
      c,
    );
    client.setQueryData(["planning-committees", "term", c.expectedContext], {
      items: [
        {
          id: "old-committee",
          name: "Hội đồng từ backend",
          lifecycle: "UNVERIFIED",
          members: [],
        },
      ],
      official: false,
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/defense/committees"]}>
          <Routes>
            <Route path="/defense" element={<Layout />}>
              <Route path="committees" element={<CommitteePlanningPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(html).toContain("Chỉ có quyền đọc");
    expect(html).toContain("Hội đồng từ backend");
    expect(html).toContain("UNVERIFIED");
    expect(html).toContain("Lưu/chốt bằng panel workflow server");
    expect(html).toContain("disabled");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    client.clear();
  });
  it("incompatible auth configuration stays in API error screen", () => {
    vi.stubEnv("VITE_AUTH_API", "false");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );
    expect(html).toContain("VITE_AUTH_API=true");
    expect(html).not.toContain("DEMO");
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
