import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalReportApi as api, saveFinalReportBlob } from "./api";
import { finalReportMode } from "./config";
import { contextFixture, pdfFixture, reportFixture } from "./test-fixtures";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  token: vi.fn(),
}));
vi.mock("../../../shared/api/http-client", () => ({
  httpClient: { get: mocks.get, put: mocks.put },
}));
vi.mock("../../../shared/api/api-session", () => ({
  getAccessToken: mocks.token,
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VITE_FINAL_REPORT_API", "true");
  vi.stubEnv("VITE_AUTH_API", "true");
  mocks.token.mockReturnValue("unit-token");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("student final-report API opt-in", () => {
  it.each([undefined, "", "false", "1"])(
    "does not enable real API for flag %s",
    async (value) => {
      vi.stubEnv("VITE_FINAL_REPORT_API", value);
      expect(finalReportMode()).toBe("DEMO");
      await expect(api.context("proposal-pdf")).rejects.toThrow("API PDF thật");
      expect(mocks.get).not.toHaveBeenCalled();
    },
  );
  it("is independent of the UC17 flag and requires real auth", async () => {
    vi.stubEnv("VITE_DEFENSE_CONFIRMATION_API", "false");
    expect(finalReportMode()).toBe("API");
    vi.stubEnv("VITE_AUTH_API", "false");
    expect(finalReportMode()).toBe("CONFIGURATION_ERROR");
    await expect(api.context("proposal-pdf")).rejects.toThrow();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("does not make a request without a real JWT token", async () => {
    mocks.token.mockReturnValue(null);
    await expect(api.metadata("proposal-pdf")).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.get).not.toHaveBeenCalled();
  });
});

describe("student final-report HTTP adapter", () => {
  it("reads student context including its window and current metadata without requesting the management API", async () => {
    const context = contextFixture(),
      report = reportFixture();
    mocks.get
      .mockResolvedValueOnce({ data: { data: context } })
      .mockResolvedValueOnce({ data: { data: report } });
    expect(await api.context("proposal-pdf")).toEqual(context);
    expect(await api.metadata("proposal-pdf")).toEqual(report);
    expect(mocks.get.mock.calls.map((call) => call[0])).toEqual([
      "/proposals/proposal-pdf/final-report-context",
      "/proposals/proposal-pdf/final-report",
    ]);
  });
  it("encodes opaque proposal IDs and rejects responses for another proposal", async () => {
    mocks.get.mockResolvedValue({
      data: { data: { ...reportFixture(), proposalId: "a/b ?" } },
    });
    await api.metadata("a/b ?");
    expect(mocks.get.mock.calls[0][0]).toBe(
      "/proposals/a%2Fb%20%3F/final-report",
    );
    await expect(api.metadata("other")).rejects.toThrow("khớp hồ sơ");
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...contextFixture(),
          report: { ...reportFixture(), proposalId: "other" },
        },
      },
    });
    await expect(api.context("proposal-pdf")).rejects.toThrow("khớp hồ sơ");
  });
  it.each([0, 5])(
    "sends exactly file and expectedRevision for initial/replacement upload %i",
    async (revision) => {
      const pdf = pdfFixture();
      mocks.put.mockResolvedValue({
        data: { data: reportFixture(revision + 1) },
      });
      const saved = await api.upload("proposal-pdf", pdf, revision);
      expect(saved.revision).toBe(revision + 1);
      const [url, body, options] = mocks.put.mock.calls[0];
      expect(url).toBe("/proposals/proposal-pdf/final-report");
      expect(body).toBeInstanceOf(FormData);
      expect([...body.keys()].sort()).toEqual(["expectedRevision", "file"]);
      expect(body.getAll("file")).toHaveLength(1);
      expect(body.get("file").name).toBe(pdf.name);
      expect(body.get("expectedRevision")).toBe(String(revision));
      expect(options.headers["Content-Type"]).toBeUndefined();
    },
  );
  it("exposes progress without treating sent bytes as successful commit", async () => {
    const progress = vi.fn();
    mocks.put.mockResolvedValue({ data: { data: reportFixture(1) } });
    await api.upload("proposal-pdf", pdfFixture(), 0, progress);
    const { onUploadProgress } = mocks.put.mock.calls[0][2];
    onUploadProgress({ loaded: 100, total: 100 });
    expect(progress).toHaveBeenLastCalledWith(99);
    onUploadProgress({ loaded: 10 });
    expect(progress).toHaveBeenLastCalledWith(0);
  });
  it.each([-1, 1.5, 2147483647])(
    "rejects invalid expectedRevision %s before HTTP",
    async (revision) => {
      await expect(
        api.upload("proposal-pdf", pdfFixture(), revision),
      ).rejects.toThrow();
      expect(mocks.put).not.toHaveBeenCalled();
    },
  );
  it("does not accept unverified upload acknowledgement or a demo file object", async () => {
    mocks.put.mockResolvedValue({ data: { data: reportFixture(9) } });
    await expect(api.upload("proposal-pdf", pdfFixture(), 0)).rejects.toThrow(
      "tải lại",
    );
    mocks.put.mockClear();
    await expect(
      api.upload(
        "proposal-pdf",
        { dataUrl: "data:demo" } as unknown as File,
        0,
      ),
    ).rejects.toThrow("chọn");
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it("downloads the current private PDF via JWT HTTP, with no path or public URL parameters", async () => {
    const blob = new Blob(["%PDF-unit"], { type: "application/pdf" });
    mocks.get.mockResolvedValue({ data: blob });
    expect(await api.download("proposal-pdf")).toBe(blob);
    expect(mocks.get).toHaveBeenCalledWith(
      "/proposals/proposal-pdf/final-report/download",
      { responseType: "blob" },
    );
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it("rejects empty or non-PDF download responses", async () => {
    for (const blob of [
      new Blob([], { type: "application/pdf" }),
      new Blob(['{"error":true}'], { type: "application/json" }),
    ]) {
      mocks.get.mockResolvedValue({ data: blob });
      await expect(api.download("proposal-pdf")).rejects.toThrow("PDF hợp lệ");
    }
  });
  it.each([400, 401, 403, 404, 409, 413, 422, undefined])(
    "propagates HTTP/network failure %s without fake data",
    async (status) => {
      const error = Object.assign(new Error("transport refused"), { status });
      mocks.get.mockRejectedValue(error);
      mocks.put.mockRejectedValue(error);
      await expect(api.context("proposal-pdf")).rejects.toBe(error);
      await expect(api.upload("proposal-pdf", pdfFixture(), 0)).rejects.toBe(
        error,
      );
      expect(mocks.get).toHaveBeenCalledOnce();
      expect(mocks.put).toHaveBeenCalledOnce();
    },
  );
  it("never writes PDF or JWT to localStorage", async () => {
    const setItem = vi.fn(() => {
      throw new Error("must not persist");
    });
    vi.stubGlobal("localStorage", { setItem });
    mocks.put.mockResolvedValue({ data: { data: reportFixture(1) } });
    await api.upload("proposal-pdf", pdfFixture(), 0);
    expect(setItem).not.toHaveBeenCalled();
  });
  it("saves a temporary Blob URL with a fixed safe name and revokes it", () => {
    vi.useFakeTimers();
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    });
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:unit");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    saveFinalReportBlob(new Blob(["pdf"]));
    expect(anchor.download).toBe("final-report.pdf");
    expect(anchor.href).toBe("blob:unit");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:unit");
    create.mockRestore();
    revoke.mockRestore();
  });
});
