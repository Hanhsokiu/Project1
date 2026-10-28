import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  planningApi as api,
  defensePlanningMode,
  planningErrorMessage,
} from "./api";
import { planningInputFixture } from "./test-fixtures";
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
  vi.stubEnv("VITE_DEFENSE_PLANNING_API", "true");
  vi.stubEnv("VITE_AUTH_API", "true");
  mocks.token.mockReturnValue("unit-token");
});
afterEach(() => vi.unstubAllEnvs());
describe("UC19–21 live adapter separate from demo", () => {
  it("is off by default and does not silently enable API with mock auth", () => {
    vi.stubEnv("VITE_DEFENSE_PLANNING_API", "false");
    expect(defensePlanningMode()).toBe("DEMO");
    expect(() => api.terms()).toThrow();
    vi.stubEnv("VITE_DEFENSE_PLANNING_API", "true");
    vi.stubEnv("VITE_AUTH_API", "false");
    expect(defensePlanningMode()).toBe("CONFIGURATION_ERROR");
    expect(() => api.context("term")).toThrow();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("requires JWT for real API and never creates a mock session", () => {
    mocks.token.mockReturnValue(null);
    expect(() => api.context("term")).toThrow("đăng nhập");
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("uses new scoped reads and never invokes the locked legacy committee reader", async () => {
    mocks.get.mockResolvedValue({ data: { data: { items: [] } } });
    await api.terms();
    await api.context("term/a");
    await api.committees("term/a");
    await api.committee("term/a", "c/b");
    await api.reviewers("term/a");
    await api.schedule("term/a");
    expect(mocks.get.mock.calls.map((c) => c[0])).toEqual([
      "/defense-planning/terms",
      "/terms/term%2Fa/defense-planning/context",
      "/terms/term%2Fa/defense-planning/committees",
      "/terms/term%2Fa/defense-planning/committees/c%2Fb",
      "/terms/term%2Fa/defense-planning/reviewers",
      "/terms/term%2Fa/defense-planning/schedule",
    ]);
  });
  it("sends backend expectedContext verbatim in three nonpersistent preview contracts", async () => {
    const input = planningInputFixture();
    mocks.post.mockResolvedValue({ data: { data: { persisted: false } } });
    await api.previewCommittees("term", {
      expectedContext: input.expectedContext,
      committees: input.committees,
    });
    await api.previewReviewers("term", {
      expectedContext: input.expectedContext,
      committees: input.committees,
      reviewers: input.reviewers,
    });
    await api.previewSchedule("term", input);
    expect(mocks.post.mock.calls.map((c) => c[0])).toEqual([
      "/terms/term/defense-planning/committees/preview",
      "/terms/term/defense-planning/reviewers/preview",
      "/terms/term/defense-planning/schedule/preview",
    ]);
    expect(mocks.post).toHaveBeenLastCalledWith(expect.any(String), input);
  });
  it.each([400, 401, 403, 404, 409, 422, 503])(
    "propagates %s without fake success, retries or demo fallback",
    async (status) => {
      const error = Object.assign(new Error("API failed"), { status });
      mocks.post.mockRejectedValueOnce(error);
      await expect(
        api.previewSchedule("term", planningInputFixture()),
      ).rejects.toBe(error);
      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(mocks.get).not.toHaveBeenCalled();
      expect(planningErrorMessage(error)).toBeTruthy();
    },
  );
  it("rejects client actor/snapshot or unknown committee role before HTTP", () => {
    const input = planningInputFixture();
    expect(() =>
      api.previewSchedule("term", {
        ...input,
        actorId: "admin",
      } as typeof input),
    ).toThrow();
    input.committees[0].members[0].role = "REVIEWER" as "CHAIR";
    expect(() => api.previewSchedule("term", input)).toThrow();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("explains 409 requires a new source/plan rather than silent rebase", () => {
    expect(planningErrorMessage({ status: 409 })).toContain("khởi tạo lại");
    expect(planningErrorMessage({ status: 403 })).toContain(
      "không tự bỏ qua grant",
    );
  });
});
