import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defenseConfirmationApi as api, saveReportBlob } from "./api";
import { defenseConfirmationMode } from "./config";
import { buildDecisionInput } from "./validation";
import {
  contextFixture,
  decisionFixture,
  historyFixture,
} from "./test-fixtures";

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
  vi.clearAllMocks();
  vi.stubEnv("VITE_DEFENSE_CONFIRMATION_API", "true");
  vi.stubEnv("VITE_AUTH_API", "true");
  mocks.token.mockReturnValue("unit-token");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("UC17 real API opt-in", () => {
  it.each([undefined, "", "false", "1"])(
    "preserves DEMO unless flag is exactly true (%s)",
    (flag) => {
      vi.stubEnv("VITE_DEFENSE_CONFIRMATION_API", flag);
      expect(defenseConfirmationMode()).toBe("DEMO");
      expect(() => api.context("proposal-a")).toThrow("API thật");
      expect(mocks.get).not.toHaveBeenCalled();
    },
  );
  it("does not fall back to mock login/data if JWT auth is disabled", () => {
    vi.stubEnv("VITE_AUTH_API", "false");
    expect(defenseConfirmationMode()).toBe("CONFIGURATION_ERROR");
    expect(() => api.context("proposal-a")).toThrow();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("requires a real access token", () => {
    mocks.token.mockReturnValue(null);
    expect(() => api.context("proposal-a")).toThrow("đăng nhập");
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
describe("UC17 HTTP adapter", () => {
  it("reads official term options and paginated inbox without a demo list", async () => {
    mocks.get.mockResolvedValue({ data: { data: { items: [] } } });
    await api.terms();
    await api.inbox({
      termId: "term",
      view: "ADVISOR",
      status: "PENDING",
      page: 2,
    });
    expect(mocks.get.mock.calls.map((call) => call[0])).toEqual([
      "/defense-confirmations/terms",
      "/defense-confirmations/inbox",
    ]);
    expect(mocks.get).toHaveBeenLastCalledWith("/defense-confirmations/inbox", {
      params: {
        termId: "term",
        view: "ADVISOR",
        status: "PENDING",
        page: 2,
        limit: 25,
      },
    });
  });
  it("unwraps context, current decision, and paginated history from the common envelope", async () => {
    const context = contextFixture(),
      decision = decisionFixture(),
      history = historyFixture();
    mocks.get
      .mockResolvedValueOnce({ data: { data: context } })
      .mockResolvedValueOnce({ data: { data: decision } })
      .mockResolvedValueOnce({ data: { data: history } });
    expect(await api.context("proposal-a")).toEqual(context);
    expect(await api.decision("proposal-a")).toEqual(decision);
    expect(await api.history("proposal-a", 7)).toEqual(history);
    expect(mocks.get.mock.calls.map((call) => call[0])).toEqual([
      "/proposals/proposal-a/defense-confirmation-context",
      "/proposals/proposal-a/defense-confirmation",
      "/proposals/proposal-a/defense-confirmation/history",
    ]);
    expect(mocks.get).toHaveBeenLastCalledWith(expect.any(String), {
      params: { afterRevision: 7, limit: 50 },
    });
  });
  it("encodes proposalId as one path segment", async () => {
    mocks.get.mockResolvedValue({ data: { data: {} } });
    await api.context("a/b ?");
    expect(mocks.get.mock.calls[0][0]).toBe(
      "/proposals/a%2Fb%20%3F/defense-confirmation-context",
    );
  });
  it("PUT sends only the validated backend DTO with original expectations", async () => {
    const input = buildDecisionInput(contextFixture(), {
      status: "CONFIRMED",
      note: "",
      changeReason: "",
      reviewed: true,
    });
    mocks.put.mockResolvedValue({ data: { data: { changed: true } } });
    expect(await api.put("proposal-a", input)).toEqual({ changed: true });
    expect(mocks.put).toHaveBeenCalledOnce();
    expect(mocks.put).toHaveBeenCalledWith(
      "/proposals/proposal-a/defense-confirmation",
      input,
    );
  });
  it("does not send invalid decision data", async () => {
    const input = buildDecisionInput(contextFixture(), {
      status: "CONFIRMED",
      note: "",
      changeReason: "",
      reviewed: true,
    });
    await expect(
      api.put("proposal-a", { ...input, status: "REJECTED" }),
    ).rejects.toThrow();
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it("downloads via authenticated HTTP using exactly the backend PDF identity", async () => {
    const identity = contextFixture().expectedContext!.pdf!;
    const blob = new Blob(["%PDF-unit"], { type: "application/pdf" });
    mocks.get.mockResolvedValue({ data: blob });
    expect(await api.download("proposal-a", identity)).toBe(blob);
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(mocks.get).toHaveBeenCalledWith(
      "/proposals/proposal-a/defense-confirmation/report/download",
      { params: identity, responseType: "blob" },
    );
  });
  it("does not download incomplete identity or treat a JSON response as PDF", async () => {
    await expect(
      api.download("proposal-a", {
        finalReportId: "report-a",
        revision: 0,
        checksum: "bad",
      }),
    ).rejects.toThrow();
    expect(mocks.get).not.toHaveBeenCalled();
    mocks.get.mockResolvedValue({
      data: new Blob(['{"error":true}'], { type: "application/json" }),
    });
    await expect(
      api.download("proposal-a", contextFixture().expectedContext!.pdf!),
    ).rejects.toThrow("PDF hợp lệ");
  });
  it.each([400, 401, 403, 404, 409, 422])(
    "propagates %i rather than simulating success",
    async (status) => {
      const error = Object.assign(new Error("backend refused"), { status });
      mocks.get.mockRejectedValue(error);
      await expect(api.context("proposal-a")).rejects.toBe(error);
      expect(mocks.put).not.toHaveBeenCalled();
    },
  );
  it("uses a Blob URL and safe basename, then revokes the URL", () => {
    vi.useFakeTimers();
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    const appendChild = vi.fn();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { appendChild },
    });
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:unit");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    saveReportBlob(new Blob(["pdf"]), "../../bad\r\n:name.pdf");
    expect(anchor.download).toBe("bad___name.pdf");
    expect(anchor.href).toBe("blob:unit");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:unit");
    create.mockRestore();
    revoke.mockRestore();
  });
});
