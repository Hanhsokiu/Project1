import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  workflowApi as api,
  officialWorkflowEnabled,
  workflowError,
} from "./api";
import { officialContextFixture, policyFixture } from "./test-fixtures";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  token: vi.fn(),
}));
vi.mock("../../../shared/api/http-client", () => ({
  httpClient: { get: mocks.get, put: mocks.put, post: mocks.post },
}));
vi.mock("../../../shared/api/api-session", () => ({
  getAccessToken: mocks.token,
}));
const command = () => ({
  expectedRevision: 1,
  expectedContext: "a".repeat(64),
  requestId: "test-command-123456",
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_AUTH_API", "true");
  vi.stubEnv("VITE_DEFENSE_LIST_API", "true");
  vi.stubEnv("VITE_DEFENSE_PLANNING_API", "true");
  mocks.token.mockReturnValue("unit-token");
  for (const method of [mocks.get, mocks.put, mocks.post])
    method.mockResolvedValue({
      data: { data: { changed: true, revision: 2 } },
    });
});
afterEach(() => vi.unstubAllEnvs());
describe("Official UC18–21 API without DemoDb", () => {
  it("requires explicit existing flags and real JWT", async () => {
    vi.stubEnv("VITE_DEFENSE_LIST_API", "false");
    vi.stubEnv("VITE_DEFENSE_PLANNING_API", "false");
    expect(officialWorkflowEnabled()).toBe(false);
    await expect(api.context("term")).rejects.toThrow("feature flag");
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("auth disabled or missing token never becomes a demo success", async () => {
    vi.stubEnv("VITE_AUTH_API", "false");
    await expect(api.context("term")).rejects.toThrow();
    vi.stubEnv("VITE_AUTH_API", "true");
    mocks.token.mockReturnValue(null);
    await expect(api.context("term")).rejects.toMatchObject({ status: 401 });
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("uses context/revision from the server verbatim", async () => {
    const c = officialContextFixture();
    mocks.get.mockResolvedValue({ data: { data: c } });
    expect(await api.context("term")).toBe(c);
    await api.finalizeList("term", command());
    expect(mocks.post).toHaveBeenCalledWith(
      "/terms/term/defense-list/finalize",
      command(),
      { timeout: 75000 },
    );
  });
  it("connects policy, academic stream/history and reopen", async () => {
    await api.configure("term", { ...command(), policy: policyFixture() });
    await api.academic("term", {
      ...command(),
      termStudentId: "member",
      verdict: "SATISFIED",
      sourceReference: "TEST source",
      note: "",
    });
    await api.history("term", "member");
    await api.reopen("term", { ...command(), reason: "TEST reopen" });
    expect(mocks.put.mock.calls[0][0]).toBe(
      "/terms/term/defense-list/workflow-policy",
    );
    expect(mocks.post.mock.calls.map((c) => c[0])).toEqual([
      "/terms/term/defense-list/academic-evidence",
      "/terms/term/defense-list/reopen",
    ]);
  });
  it("connects save/finalize/publish/amend using distinct commands", async () => {
    await api.save("term", "COMMITTEES", {
      ...command(),
      draft: { committees: [] },
    });
    await api.seal("term", "REVIEWERS", command());
    await api.publish("term", command());
    await api.amend("term", {
      ...command(),
      draft: { slots: [] },
      reason: "TEST amendment",
    });
    expect(mocks.put.mock.calls[0][0]).toBe(
      "/terms/term/defense-workflow/COMMITTEES/draft",
    );
    expect(mocks.post.mock.calls.map((c) => c[0])).toEqual([
      "/terms/term/defense-workflow/REVIEWERS/finalize",
      "/terms/term/defense-workflow/SCHEDULE/publish",
      "/terms/term/defense-workflow/SCHEDULE/amend",
    ]);
  });
  it.each([400, 401, 403, 404, 409, 422, 503, undefined])(
    "propagates %s, no retry or mock fallback",
    async (status) => {
      const error = Object.assign(new Error("test api failure"), { status });
      mocks.post.mockRejectedValue(error);
      await expect(api.finalizeList("term", command())).rejects.toBe(error);
      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(mocks.get).not.toHaveBeenCalled();
    },
  );
  it("validates reasons, capacity and extra actor fields before sending", async () => {
    await expect(
      api.reopen("term", { ...command(), reason: "  " }),
    ).rejects.toThrow();
    const policy = policyFixture();
    policy.committeeCapacity = 0;
    await expect(
      api.configure("term", { ...command(), policy }),
    ).rejects.toThrow();
    await expect(
      api.academic("term", {
        ...command(),
        termStudentId: "member",
        verdict: "SATISFIED",
        sourceReference: "TEST",
        note: "",
        actorId: "forged",
      } as never),
    ).rejects.toThrow();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it("private published endpoint is independent of demo file URLs", async () => {
    await api.published("term");
    expect(mocks.get.mock.calls[0][0]).toBe(
      "/terms/term/defense-schedule/published",
    );
    expect(mocks.get.mock.calls[0][0]).not.toContain("/committees/term");
  });
  it("gives an explicit review instruction for 409 and controlled missing-schema message", () => {
    expect(workflowError({ status: 409 })).toContain("xem dữ liệu");
    expect(workflowError({ status: 503 })).toContain("Không có dữ liệu nào");
  });
});
