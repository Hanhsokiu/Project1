import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConfirmationContextView,
  ConfirmationDecisionForm,
  ConfirmationHistory,
  CurrentDecisionView,
} from "./components";
import DefenseConfirmPage from "../pages/DefenseConfirmPage";
import { contextFixture, decisionFixture } from "./test-fixtures";

const mocks = vi.hoisted(() => ({
  useDemo: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
}));
vi.mock("../../../shared/hooks/use-demo", () => ({
  useDemo: mocks.useDemo,
  useAction: vi.fn(),
}));
vi.mock("../../../shared/api/http-client", () => ({
  httpClient: { get: mocks.get, put: mocks.put },
}));
vi.mock("../../../shared/api/api-session", () => ({
  AUTH_API: false,
  getApiUser: () => ({ id: "unit-advisor", roles: ["LECTURER"] }),
  getAccessToken: () => "unit-token",
}));
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
describe("UC17 real view transport projection", () => {
  it("shows actual proposal, progress warning, independent window and PDF without exposing storage fields", () => {
    const c = contextFixture();
    c.pdfChangedSinceDecision = true;
    const html = renderToStaticMarkup(
      <ConfirmationContextView
        context={c}
        downloading={false}
        onDownload={() => undefined}
      />,
    );
    expect(html).toContain("SV_API");
    expect(html).toContain("Nhiệm vụ chưa hoàn thành");
    expect(html).toContain("Cửa sổ xác nhận UC17");
    expect(html).toContain("Đã thay đổi");
    expect(html).toContain("Đồ án.pdf");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("filePath");
    expect(html).not.toContain(c.pdf.snapshot!.checksum);
  });
  it("does not turn unknown legacy evidence into false", () => {
    const c = contextFixture();
    c.legacy.decision = true;
    const html = renderToStaticMarkup(
      <ConfirmationContextView
        context={c}
        downloading={false}
        onDownload={() => undefined}
      />,
    );
    expect(html).toContain("Chưa xác định");
    expect(html).toContain("legacy");
  });
  it("distinguishes absent, PENDING and legacy current decisions", () => {
    const d = decisionFixture();
    expect(
      renderToStaticMarkup(<CurrentDecisionView response={d} />),
    ).toContain("Chưa có quyết định");
    d.configured = true;
    d.decision.state = "PENDING";
    d.decision.status = "PENDING";
    expect(
      renderToStaticMarkup(<CurrentDecisionView response={d} />),
    ).toContain("Bản ghi PENDING");
    d.decision.state = "LEGACY";
    expect(
      renderToStaticMarkup(<CurrentDecisionView response={d} />),
    ).toContain("Quyết định legacy");
  });
  it("shows REJECTED, changeReason, explicit review and server blockers rather than a progress hard gate", () => {
    const c = contextFixture();
    c.changeReasonRequiredForChanges = true;
    c.decision.status = "REJECTED";
    c.readiness.reject = {
      allowed: false,
      blockers: [{ code: "UC18_UNKNOWN", message: "Chưa có UC18 OPEN" }],
    };
    const html = renderToStaticMarkup(
      <ConfirmationDecisionForm
        context={c}
        busy={false}
        onSubmit={() => undefined}
      />,
    );
    expect(html).toContain("Lý do từ chối (bắt buộc)");
    expect(html).toContain("Lý do thay đổi (bắt buộc)");
    expect(html).toContain("Chưa có UC18 OPEN");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("100%");
  });
  it("shows immutable history and supports more revisions without PDF private evidence", () => {
    const html = renderToStaticMarkup(
      <ConfirmationHistory
        state="AVAILABLE"
        hasMore
        busy={false}
        onMore={() => undefined}
        items={[
          {
            id: "h1",
            revision: 1,
            status: "CONFIRMED",
            note: "Đạt",
            changeReason: "Đã xem lại",
            decidedAt: "2026-10-27T00:00:00Z",
            actor: { displayName: "Người quyết định" },
            advisor: { fullName: "GVHD" },
            snapshotSchemaVersion: 1,
            pdfRevision: 2,
          },
        ]}
      />,
    );
    expect(html).toContain("Revision 1");
    expect(html).toContain("Đã xem lại");
    expect(html).toContain("Xem lịch sử tiếp theo");
    expect(html).not.toContain("checksum");
  });
});
describe("UC17 real/demo page switch", () => {
  it("keeps the existing demo DataBoundary when the UC17 flag is off", () => {
    vi.stubEnv("VITE_DEFENSE_CONFIRMATION_API", "false");
    mocks.useDemo.mockReturnValue({ isPending: true });
    const html = renderToStaticMarkup(<DefenseConfirmPage />);
    expect(html).toContain("loading");
    expect(mocks.useDemo).toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("fails closed on incompatible auth flags instead of entering the mock screen", () => {
    vi.stubEnv("VITE_DEFENSE_CONFIRMATION_API", "true");
    vi.stubEnv("VITE_AUTH_API", "false");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DefenseConfirmPage />
      </MemoryRouter>,
    );
    expect(html).toContain("VITE_AUTH_API=true");
    expect(mocks.useDemo).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("real mode without a proposal offers detail navigation, never a mock student list", () => {
    vi.stubEnv("VITE_DEFENSE_CONFIRMATION_API", "true");
    vi.stubEnv("VITE_AUTH_API", "true");
    const html = renderToStaticMarkup(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: Infinity } },
          })
        }
      >
        <MemoryRouter>
          <DefenseConfirmPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(html).toContain("Mã hồ sơ Proposal");
    expect(html).toContain("proposalId");
    expect(html).not.toContain("Theo dõi hồ sơ trong phạm vi");
    expect(mocks.useDemo).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it.each(["STUDENT", "FACULTY"] as const)(
    "renders %s decision without advisor context or write form",
    (viewer) => {
      vi.stubEnv("VITE_DEFENSE_CONFIRMATION_API", "true");
      vi.stubEnv("VITE_AUTH_API", "true");
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      const current = decisionFixture();
      current.viewer = viewer;
      const key = [
        "defense-confirmation",
        "unit-advisor:unit-token",
        "proposal-a",
      ];
      client.setQueryData([...key, "decision"], current);
      const html = renderToStaticMarkup(
        <QueryClientProvider client={client}>
          <MemoryRouter
            initialEntries={["/guidance/defense-confirm?proposalId=proposal-a"]}
          >
            <DefenseConfirmPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      expect(html).toContain("Chế độ chỉ đọc");
      expect(html).toContain(viewer);
      expect(html).not.toContain("Gửi quyết định");
      expect(html).not.toContain("Cửa sổ xác nhận UC17");
      expect(mocks.useDemo).not.toHaveBeenCalled();
      expect(mocks.get).not.toHaveBeenCalled();
      client.clear();
    },
  );
});
