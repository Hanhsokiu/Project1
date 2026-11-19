import { beforeEach, describe, expect, it, vi } from "vitest";
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/http-client", () => ({ httpClient: http }));
import { reviewerApi } from "./api";
import { syntheticWorkspace } from "./reviewer.fixture";
beforeEach(() => {
  vi.clearAllMocks();
});
describe("UC20 authenticated API adapter", () => {
  it("unwraps server data and sends term/selected ids for preview without POST", async () => {
    http.get.mockResolvedValue({ data: { data: syntheticWorkspace() } });
    expect((await reviewerApi.workspace("term")).termId).toBe("term");
    await reviewerApi.terms();
    await reviewerApi.propose("term", ["s", "s2"]);
    expect(http.get).toHaveBeenLastCalledWith("/defense-reviewers/allocation", {
      params: { termId: "term", termStudentIds: "s,s2" },
    });
    expect(http.post).not.toHaveBeenCalled();
  });
  it("posts exact bindings and stable supplied Idempotency-Key to save/update/finalize", async () => {
    http.post.mockResolvedValue({ data: { success: true } });
    const b = {
      termId: "term",
      rosterHash: "f".repeat(64),
      reason: "Synthetic",
      placements: [
        { ...syntheticWorkspace().students[0].binding!, reviewerIds: ["l"] },
      ],
    };
    await reviewerApi.assign(b, "same");
    expect(http.post).toHaveBeenLastCalledWith(
      "/defense-reviewers/assignments",
      b,
      { headers: { "Idempotency-Key": "same" } },
    );
    await reviewerApi.update("s/1", b, "retry");
    expect(http.post.mock.calls[1][0]).toBe("/defense-reviewers/s%2F1/update");
    await reviewerApi.finalize(
      {
        termId: "term",
        rosterHash: b.rosterHash,
        reason: "Synthetic",
        members: [syntheticWorkspace().students[0].binding!],
      },
      "final",
    );
    expect(http.post.mock.calls[2][0]).toBe("/defense-reviewers/finalize");
  });
  it.each([401, 403, 404, 409])(
    "propagates HTTP %i instead of reporting fake success",
    async (status) => {
      const error = Object.assign(new Error("Synthetic"), { status });
      http.post.mockRejectedValue(error);
      await expect(reviewerApi.assign({} as never, "key")).rejects.toBe(error);
    },
  );
});
