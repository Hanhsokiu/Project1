import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  gradingApi as api,
  gradingMode,
  gradingErrorText,
  gradingBlockerText,
} from "./api";
import { gradeContextFixture, gradePolicyFixture } from "./test-fixtures";
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
const command = {
  expectedRevision: 1,
  expectedContext: "a".repeat(64),
  requestId: "test-request-123456",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_AUTH_API", "true");
  vi.stubEnv("VITE_GRADING_API", "true");
  mocks.token.mockReturnValue("test-token");
  [mocks.get, mocks.post, mocks.put].forEach((m) =>
    m.mockResolvedValue({ data: { data: { changed: true, revision: 2 } } }),
  );
});
afterEach(() => vi.unstubAllEnvs());
describe("UC22–25 real adapters without DemoDb", () => {
  it("real auth with grading off is disabled; real adapter refuses access", async () => {
    vi.stubEnv("VITE_GRADING_API", "false");
    expect(gradingMode()).toBe("DISABLED");
    await expect(api.inbox("term", "REVIEWER")).rejects.toThrow();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it.each(["policy", "result"] as const)(
    "reads %s history with the backend cursor contract",
    async (kind) => {
      const page = {
        items: [
          {
            revision: 26,
            recordedAt: "2026-10-29T00:00:00Z",
            actorUserId: "actor",
            integrity: "UNKNOWN",
          },
        ],
        nextRevision: 26,
      };
      mocks.get.mockResolvedValue({ data: { data: page } });
      const result =
        kind === "policy"
          ? await api.policyHistory("term", 25)
          : await api.resultHistory("term", "p/a", 25);
      expect(result).toBe(page);
      expect(mocks.get).toHaveBeenCalledWith(
        `/terms/term/grading/${kind === "policy" ? "policy" : "results/p%2Fa"}/history`,
        { timeout: 75000, params: { afterRevision: 25, limit: 25 } },
      );
    },
  );
  it("rejects invalid history cursors and proposal IDs before HTTP", async () => {
    await expect(api.policyHistory("term", -1)).rejects.toThrow();
    await expect(api.resultHistory("term", "", 0)).rejects.toThrow();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it.each([403, 409, 503])(
    "history %s errors propagate without fabricated rows",
    async (status) => {
      mocks.get.mockRejectedValue({ status });
      await expect(api.policyHistory("term")).rejects.toMatchObject({ status });
      await expect(api.resultHistory("term", "proposal")).rejects.toMatchObject(
        { status },
      );
    },
  );
  it("flag on and auth off is CONFIG_ERROR, never demo fallback", async () => {
    vi.stubEnv("VITE_AUTH_API", "false");
    expect(gradingMode()).toBe("CONFIG_ERROR");
    await expect(api.context("term", "proposal", "REVIEWER")).rejects.toThrow();
  });
  it("missing token is401 before HTTP", async () => {
    mocks.token.mockReturnValue(null);
    await expect(
      api.context("term", "proposal", "COMMITTEE"),
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("inbox, context and GET CAS values are taken directly from backend", async () => {
    const c = gradeContextFixture();
    mocks.get.mockResolvedValue({ data: { data: c } });
    await api.inbox("term", "REVIEWER");
    expect(await api.context("term", "proposal", "REVIEWER")).toBe(c);
    await api.save("term", "proposal", "REVIEWER", {
      ...command,
      draft: c.grade.draft!,
    });
    expect(mocks.put).toHaveBeenCalledWith(
      "/terms/term/grading/proposals/proposal/REVIEWER/draft",
      { ...command, draft: c.grade.draft },
      { timeout: 75000 },
    );
  });
  it("seal sends saved-draft revision/context without client snapshot or actor", async () => {
    await api.seal("term", "proposal", "COMMITTEE", command);
    expect(mocks.post.mock.calls[0]).toEqual([
      "/terms/term/grading/proposals/proposal/COMMITTEE/seal",
      command,
      { timeout: 75000 },
    ]);
  });
  it("policy can configure windows/rubric, not self-approve calculation", async () => {
    await api.configure("term", { ...command, config: gradePolicyFixture() });
    expect(mocks.put.mock.calls[0][0]).toBe("/terms/term/grading/policy");
    const config = gradePolicyFixture();
    config.calculation = { state: "CONFIRMED" } as never;
    await expect(
      api.configure("term", { ...command, config }),
    ).rejects.toThrow();
    expect(mocks.put).toHaveBeenCalledOnce();
  });
  it("rejects invalid scores and injected actor before request", async () => {
    await expect(
      api.save("term", "proposal", "REVIEWER", {
        ...command,
        draft: { values: { A: 11 }, comment: "", questions: [] },
      }),
    ).rejects.toThrow();
    await expect(
      api.seal("term", "proposal", "REVIEWER", {
        ...command,
        actorId: "ADMIN",
      } as never),
    ).rejects.toThrow();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("PDF uses private blob request with exactly the context identity", async () => {
    const c = gradeContextFixture(),
      identity = {
        finalReportId: c.pdf!.finalReportId,
        revision: c.pdf!.revision,
        checksum: c.pdf!.checksum,
      };
    mocks.get.mockResolvedValue({ data: "private-pdf-blob" });
    expect(await api.download("term", "proposal", "REVIEWER", identity)).toBe(
      "private-pdf-blob",
    );
    expect(mocks.get.mock.calls[0][1]).toMatchObject({
      params: identity,
      responseType: "blob",
    });
    expect(JSON.stringify(mocks.get.mock.calls)).not.toMatch(
      /storageKey|filePath/,
    );
  });
  it("student reads own per-proposal publications, not a term-wide flag", async () => {
    await api.myResults("term");
    expect(mocks.get.mock.calls[0][0]).toBe("/terms/term/grading/my-results");
  });
  it("exports by backend scope/filter, never sends spreadsheet rows or mock data", async () => {
    await api.export("term", "RESULTS", "XLSX", { className: "CNTT1" });
    expect(mocks.get.mock.calls[0]).toEqual([
      "/terms/term/official-reports/export",
      {
        timeout: 75000,
        params: { kind: "RESULTS", format: "XLSX", className: "CNTT1" },
        responseType: "blob",
        validateStatus: expect.any(Function),
      },
    ]);
  });
  it.each([400, 401, 403, 404, 409, 422, 503, undefined])(
    "propagates %s once without mock success",
    async (status) => {
      const error = Object.assign(new Error("test"), { status });
      mocks.post.mockRejectedValue(error);
      await expect(
        api.seal("term", "proposal", "REVIEWER", command),
      ).rejects.toBe(error);
      expect(mocks.post).toHaveBeenCalledOnce();
      expect(mocks.get).not.toHaveBeenCalled();
    },
  );
  it("409 asks for a new review, 403 explains scope, 503 does not fake persistence", () => {
    expect(gradingErrorText({ status: 409 })).toContain("xem lại");
    expect(gradingErrorText({ status: 403 })).toContain("grant");
    expect(gradingErrorText({ status: 503 })).toContain("Schema");
  });
  it.each([
    "CALCULATION_POLICY_NEEDS_APPROVAL",
    "ADVISOR_GRADE_UNKNOWN_OR_STALE",
    "COUNCIL_RESULT_CONFIRMATION_NEEDS_APPROVAL",
    "GRADING_WINDOW_CLOSED",
    "REPORT_TEMPLATE_NOT_CONFIGURED",
  ])("explains %s without implying a reload approves policy", (code) => {
    expect(gradingBlockerText(code)).not.toBe(code);
    expect(gradingErrorText({ status: 409, code })).toContain(
      gradingBlockerText(code),
    );
    expect(gradingErrorText({ status: 409, code })).not.toContain(
      "trước khi thử tiếp",
    );
  });
  it.each([403, 409, 422, 503])(
    "decodes a private binary %s error instead of downloading JSON as PDF",
    async (status) => {
      mocks.get.mockResolvedValue({
        status,
        data: new Blob(
          [
            JSON.stringify({
              error: {
                code: "REPORT_TEMPLATE_NOT_CONFIGURED",
                message: "Chưa có mẫu",
              },
            }),
          ],
          { type: "application/json" },
        ),
      });
      await expect(api.export("term", "RESULTS", "PDF")).rejects.toMatchObject({
        status,
        code: "REPORT_TEMPLATE_NOT_CONFIGURED",
        message: "Chưa có mẫu",
      });
      const validate = mocks.get.mock.calls[0][1].validateStatus;
      expect(validate(401)).toBe(false); // Keep real auth refresh/expiry handling.
      expect(validate(status)).toBe(true);
      expect(mocks.get).toHaveBeenCalledOnce();
    },
  );
  it("non-JSON binary error stays an error and never falls back to demo", async () => {
    mocks.get.mockResolvedValue({
      status: 503,
      data: new Blob(["upstream unavailable"]),
    });
    await expect(api.export("term", "RESULTS", "PDF")).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.get).toHaveBeenCalledOnce();
  });
});
