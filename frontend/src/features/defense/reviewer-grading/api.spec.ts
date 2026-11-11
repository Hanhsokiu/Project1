import { beforeEach, describe, expect, it, vi } from "vitest";
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/http-client", () => ({ httpClient: http }));
import { reviewerGradeApi as api, reviewerGradeKeys as keys } from "./api";
import { ReviewerGradeQuerySchema } from "@doan/shared";
import { syntheticGradeView } from "./reviewer-grade.fixture";
beforeEach(() => vi.clearAllMocks());
describe("UC22 authenticated API and cache isolation", () => {
  it("reads options/list/detail through actual endpoint and scopes", async () => {
    http.get.mockResolvedValue({ data: { data: syntheticGradeView() } });
    await api.terms();
    await api.list(ReviewerGradeQuerySchema.parse({ termId: "term" }));
    expect((await api.detail("s/1", "term", "reviewer")).reviewerId).toBe(
      "reviewer",
    );
    expect(http.get).toHaveBeenLastCalledWith(
      "/defense-reviewer-grades/s%2F1",
      { params: { termId: "term", reviewerId: "reviewer" } },
    );
    expect(http.post).not.toHaveBeenCalled();
  });
  it("downloads protected version via blob, never a public URL", async () => {
    const blob = new Blob(["%PDF-1.7"]);
    http.get.mockResolvedValue({ data: blob });
    expect(await api.download("student", "term", "v/1")).toBe(blob);
    expect(http.get).toHaveBeenLastCalledWith(
      "/defense-reviewer-grades/student/versions/v%2F1/pdf",
      { params: { termId: "term" }, responseType: "blob" },
    );
  });
  it("sends stable retry key and only resolves after the backend responds", async () => {
    let finish!: (v: unknown) => void;
    http.post.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    let resolved = false;
    const pending = api.command("s", "save", {} as never, "same").then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    finish({ data: { success: true } });
    await pending;
    expect(http.post).toHaveBeenLastCalledWith(
      "/defense-reviewer-grades/s/save",
      {},
      { headers: { "Idempotency-Key": "same" } },
    );
    await api.command("s", "finalize", {} as never, "same");
    expect(http.post.mock.calls[1][0]).toBe(
      "/defense-reviewer-grades/s/finalize",
    );
  });
  it.each([401, 403, 404, 409, 500])(
    "propagates HTTP %i without demo/fake success",
    async (status) => {
      const e = Object.assign(new Error("TEST_ONLY"), { status });
      http.post.mockRejectedValue(e);
      await expect(api.command("s", "save", {} as never, "retry")).rejects.toBe(
        e,
      );
    },
  );
  it("isolates actor/term/student/reviewer query keys", () => {
    const base = JSON.stringify(keys.detail("A", "T", "S", "R"));
    for (const args of [
      ["B", "T", "S", "R"],
      ["A", "U", "S", "R"],
      ["A", "T", "S2", "R"],
      ["A", "T", "S", "R2"],
    ])
      expect(
        JSON.stringify(keys.detail(args[0], args[1], args[2], args[3])),
      ).not.toBe(base);
    const q = ReviewerGradeQuerySchema.parse({ termId: "T" });
    expect(keys.list("A", q)).not.toEqual(keys.list("B", q));
  });
});
