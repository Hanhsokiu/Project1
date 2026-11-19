import { beforeEach, describe, expect, it, vi } from "vitest";
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/http-client", () => ({ httpClient: http }));
import { committeeGradeApi as api, committeeGradeKeys as keys } from "./api";
import { CommitteeGradeQuerySchema } from "@doan/shared";
import { syntheticCommitteeGrade } from "./committee-grade.fixture";
beforeEach(() => vi.clearAllMocks());
describe("UC23 authenticated API and cache isolation", () => {
  it("reads options/list/own or scoped detail/progress, never writes on GET", async () => {
    http.get.mockResolvedValue({ data: { data: syntheticCommitteeGrade() } });
    await api.options();
    await api.list(
      CommitteeGradeQuerySchema.parse({ termId: "term", committeeId: "cc" }),
    );
    await api.progress(CommitteeGradeQuerySchema.parse({ termId: "term" }));
    expect((await api.detail("s/1", "term", "cc", "l1")).memberRole).toBe(
      "CHAIR",
    );
    expect(http.get).toHaveBeenLastCalledWith(
      "/defense-committee-grades/s%2F1",
      { params: { termId: "term", committeeId: "cc", lecturerId: "l1" } },
    );
    expect(http.post).not.toHaveBeenCalled();
  });
  it("downloads the exact private PDF and committee scope as a blob", async () => {
    const blob = new Blob(["%PDF-1.7"]);
    http.get.mockResolvedValue({ data: blob });
    expect(await api.download("s", "term", "cc", "v/2")).toBe(blob);
    expect(http.get).toHaveBeenLastCalledWith(
      "/defense-committee-grades/s/versions/v%2F2/pdf",
      { params: { termId: "term", committeeId: "cc" }, responseType: "blob" },
    );
  });
  it("stable supplied key and response settlement prevent premature success", async () => {
    let finish!: (v: unknown) => void;
    http.post.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    let complete = false;
    const result = api.command("s", "save", {} as never, "stable").then(() => {
      complete = true;
    });
    await Promise.resolve();
    expect(complete).toBe(false);
    finish({ data: { success: true } });
    await result;
    expect(http.post).toHaveBeenLastCalledWith(
      "/defense-committee-grades/s/save",
      {},
      { headers: { "Idempotency-Key": "stable" } },
    );
    await api.command("s", "finalize", {} as never, "stable");
    expect(http.post.mock.calls[1][0]).toBe(
      "/defense-committee-grades/s/finalize",
    );
  });
  it.each([401, 403, 404, 409, 500])(
    "HTTP %i remains an error instead of demo/fake success",
    async (status) => {
      const e = Object.assign(new Error("TEST_ONLY"), { status });
      http.post.mockRejectedValue(e);
      await expect(api.command("s", "save", {} as never, "same")).rejects.toBe(
        e,
      );
    },
  );
  it("cache is isolated by actor/term/committee/student/member and progress mode", () => {
    const base = keys.detail("A", "T", "C", "S", "L");
    for (const args of [
      ["B", "T", "C", "S", "L"],
      ["A", "U", "C", "S", "L"],
      ["A", "T", "D", "S", "L"],
      ["A", "T", "C", "S2", "L"],
      ["A", "T", "C", "S", "L2"],
    ])
      expect(
        keys.detail(args[0], args[1], args[2], args[3], args[4]),
      ).not.toEqual(base);
    const q = CommitteeGradeQuerySchema.parse({ termId: "T" });
    expect(keys.list("A", q)).not.toEqual(keys.progress("A", q));
    expect(keys.list("A", q)).not.toEqual(keys.list("B", q));
  });
});
