import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FinalReportUploadPage from "../pages/FinalReportUploadPage";
import {
  CurrentFinalReportView,
  FinalReportContextView,
  FinalReportUploadForm,
} from "./components";
import { contextFixture, reportFixture } from "./test-fixtures";

const mocks = vi.hoisted(() => ({
  useDemo: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
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
  getAccessToken: () => "unit-token",
  getApiUser: () => ({ id: "unit-student", roles: ["STUDENT"] }),
}));
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("real final PDF view", () => {
  it("shows the independent window and server-defined temporary size limit", () => {
    const c = contextFixture();
    c.maxFileBytes = 30 * 1024 * 1024;
    const html = renderToStaticMarkup(<FinalReportContextView context={c} />);
    expect(html).toContain("FINAL_REPORT_SUBMISSION");
    expect(html).toContain("30 MiB");
    expect(html).toContain("giới hạn kỹ thuật tạm thời");
    expect(html).not.toContain("4 MB");
  });
  it("shows unconfigured window without defaulting to phase FINAL or UC17", () => {
    const c = contextFixture();
    c.window = null;
    const html = renderToStaticMarkup(<FinalReportContextView context={c} />);
    expect(html).toContain("NOT_CONFIGURED");
    expect(html).toContain("Chưa cấu hình");
  });
  it("shows only the current PDF, without fabricated history, storage keys or demo URLs", () => {
    const html = renderToStaticMarkup(
      <CurrentFinalReportView
        report={reportFixture(3)}
        busy={false}
        onDownload={() => undefined}
      />,
    );
    expect(html).toContain("Đồ án.pdf");
    expect(html).toContain("Revision 3");
    expect(html).not.toContain("Lịch sử phiên bản");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("filePath");
    expect(html).not.toContain("data:application/pdf");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("GVHD đã đồng ý");
  });
  it("keeps a private download available when the submission window is closed", () => {
    const c = contextFixture(1);
    c.canSubmit = false;
    c.serverNow = c.window!.closesAt;
    const html = renderToStaticMarkup(
      <>
        <FinalReportContextView context={c} />
        <CurrentFinalReportView
          report={reportFixture(1)}
          busy={false}
          onDownload={() => undefined}
        />
      </>,
    );
    expect(html).toContain("CLOSED");
    expect(html).toContain("Tải PDF hiện hành");
    expect(html).not.toContain("disabled=");
  });
  it("distinguishes missing and legacy reports without exposing old paths", () => {
    expect(
      renderToStaticMarkup(
        <CurrentFinalReportView
          report={reportFixture()}
          busy={false}
          onDownload={() => undefined}
        />,
      ),
    ).toContain("Chưa nộp PDF");
    const report = {
      ...reportFixture(),
      state: "LEGACY_REQUIRES_RECONCILIATION" as const,
      file: null,
    };
    const html = renderToStaticMarkup(
      <CurrentFinalReportView
        report={report}
        busy={false}
        onDownload={() => undefined}
      />,
    );
    expect(html).toContain("legacy cần đối soát");
    expect(html).not.toContain("href=");
  });
  it("does not disable the file fieldset solely because UC17 is CONFIRMED", () => {
    const c = Object.assign(contextFixture(1), {
      uc17: { status: "CONFIRMED" },
    });
    const html = renderToStaticMarkup(
      <FinalReportUploadForm
        context={c}
        metadata={reportFixture(1)}
        busy={false}
        progress={0}
        onUpload={() => undefined}
      />,
    );
    expect(html).toContain("Nộp PDF thay thế");
    expect(html).toContain('type="file"');
    expect(html).not.toMatch(/<fieldset[^>]*disabled/);
    expect(html).toContain("không tự đổi quyết định UC17");
    expect(html).not.toContain("thu hồi");
  });
  it("disables upload fields for a locked window or an outstanding refresh", () => {
    const c = contextFixture();
    c.window!.locked = true;
    expect(
      renderToStaticMarkup(
        <FinalReportUploadForm
          context={c}
          metadata={reportFixture()}
          busy={false}
          progress={0}
          onUpload={() => undefined}
        />,
      ),
    ).toMatch(/<fieldset[^>]*disabled/);
    expect(
      renderToStaticMarkup(
        <FinalReportUploadForm
          context={contextFixture()}
          metadata={reportFixture()}
          busy
          progress={0}
          onUpload={() => undefined}
        />,
      ),
    ).toMatch(/<fieldset[^>]*disabled/);
  });
});

describe("final PDF demo/real mode switching", () => {
  it("preserves the demo DataBoundary with the flag disabled", () => {
    vi.stubEnv("VITE_FINAL_REPORT_API", "false");
    mocks.useDemo.mockReturnValue({ isPending: true });
    const html = renderToStaticMarkup(<FinalReportUploadPage />);
    expect(html).toContain("loading");
    expect(mocks.useDemo).toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("fails closed on real-PDF/mock-auth misconfiguration", () => {
    vi.stubEnv("VITE_FINAL_REPORT_API", "true");
    vi.stubEnv("VITE_AUTH_API", "false");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinalReportUploadPage />
      </MemoryRouter>,
    );
    expect(html).toContain("VITE_AUTH_API=true");
    expect(mocks.useDemo).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("real mode asks for a real proposal instead of selecting a demo student", () => {
    vi.stubEnv("VITE_FINAL_REPORT_API", "true");
    vi.stubEnv("VITE_AUTH_API", "true");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinalReportUploadPage />
      </MemoryRouter>,
    );
    expect(html).toContain("Mã hồ sơ Proposal");
    expect(html).toContain("Chưa chọn hồ sơ thực");
    expect(mocks.useDemo).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("real detail errors stay in the API screen without rendering or modifying demo data", () => {
    vi.stubEnv("VITE_FINAL_REPORT_API", "true");
    vi.stubEnv("VITE_AUTH_API", "true");
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, retryOnMount: false, gcTime: Infinity },
      },
    });
    for (const suffix of ["context", "metadata"]) {
      const query = client.getQueryCache().build(client, {
        queryKey: [
          "final-report",
          "unit-student:unit-token",
          "proposal-pdf",
          suffix,
        ],
      });
      query.setState({
        status: "error",
        error: Object.assign(new Error("backend refused"), { status: 403 }),
        fetchStatus: "idle",
      });
    }
    try {
      const html = renderToStaticMarkup(
        <QueryClientProvider client={client}>
          <MemoryRouter
            initialEntries={["/guidance/final-report?proposalId=proposal-pdf"]}
          >
            <FinalReportUploadPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      expect(html).toContain("không có quyền");
      expect(mocks.useDemo).not.toHaveBeenCalled();
      expect(mocks.put).not.toHaveBeenCalled();
    } finally {
      client.clear();
    }
  });
});
