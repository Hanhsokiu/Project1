import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defenseListApi as api, defenseListMode } from "./api";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  token: vi.fn(),
}));
vi.mock("../../../shared/api/http-client", () => ({
  httpClient: { get: mocks.get, post: mocks.post },
}));
vi.mock("../../../shared/api/api-session", () => ({
  getAccessToken: mocks.token,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_DEFENSE_LIST_API", "true");
  vi.stubEnv("VITE_AUTH_API", "true");
  mocks.token.mockReturnValue("unit-token");
});
afterEach(() => vi.unstubAllEnvs());
describe("UC18 API opt-in and authenticated adapter", () => {
  it("keeps demo separate, requires real auth, and never calls API in demo", () => {
    vi.stubEnv("VITE_DEFENSE_LIST_API", "false");
    expect(defenseListMode()).toBe("DEMO");
    expect(() => api.state("term")).toThrow();
    expect(mocks.get).not.toHaveBeenCalled();
    vi.stubEnv("VITE_DEFENSE_LIST_API", "true");
    vi.stubEnv("VITE_AUTH_API", "false");
    expect(defenseListMode()).toBe("CONFIGURATION_ERROR");
    expect(() => api.terms()).toThrow();
  });
  it("does not fall back to demo when JWT is absent", () => {
    mocks.token.mockReturnValue(null);
    expect(() => api.preview("term")).toThrow("đăng nhập");
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("reads terms/state/preview and sends only DRAFT/open contracts", async () => {
    mocks.get.mockResolvedValue({ data: { data: { state: "DRAFT" } } });
    mocks.post.mockResolvedValue({ data: { data: { state: "OPEN" } } });
    await api.terms();
    await api.state("term/a");
    await api.preview("term/a", 2, "WAITING_ADVISOR");
    await api.create("term/a");
    await api.open("term/a", 0);
    expect(mocks.get.mock.calls.map((c) => c[0])).toEqual([
      "/defense-lists/terms",
      "/terms/term%2Fa/defense-list",
      "/terms/term%2Fa/defense-list/preview",
    ]);
    expect(mocks.get).toHaveBeenLastCalledWith(expect.any(String), {
      params: { page: 2, limit: 25, result: "WAITING_ADVISOR" },
    });
    expect(mocks.post.mock.calls).toEqual([
      ["/terms/term%2Fa/defense-list", {}],
      ["/terms/term%2Fa/defense-list/open", { expectedRevision: 0 }],
    ]);
  });
  it.each([400, 401, 403, 404, 409, 422, 503])(
    "propagates HTTP %s without synthetic state or mock fallback",
    async (status) => {
      const error = Object.assign(new Error("API failure"), { status });
      mocks.get.mockRejectedValueOnce(error);
      await expect(api.preview("term")).rejects.toBe(error);
      expect(mocks.get).toHaveBeenCalledTimes(1);
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );
  it("rejects invalid revision without an HTTP write", async () => {
    await expect(api.open("term", -1)).rejects.toThrow("Revision");
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
