import { describe, expect, it, vi } from "vitest";
import { finalResultApi as api, finalResultKeys as keys } from "./api";
import { FinalResultQuerySchema } from "@doan/shared";
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/http-client", () => ({ httpClient: client }));
describe("UC24 API wiring/cache isolation", () => {
  it("sends scoped list/detail with encoded IDs", async () => {
    client.get.mockResolvedValue({ data: { data: { items: [] } } });
    const q = FinalResultQuerySchema.parse({ termId: "t" });
    await api.list(q);
    expect(client.get).toHaveBeenLastCalledWith("/defense-results", {
      params: q,
    });
    await api.detail("student/id", "t");
    expect(client.get).toHaveBeenLastCalledWith(
      "/defense-results/student%2Fid",
      { params: { termId: "t" } },
    );
  });
  it("preview sends only scope and does not pretend to be a saved command", async () => {
    client.post.mockResolvedValue({ data: { data: { state: "READY" } } });
    await api.preview("student", "t");
    expect(client.post).toHaveBeenLastCalledWith(
      "/defense-results/student/preview",
      { termId: "t" },
    );
  });
  it.each(["confirm", "finalize", "publish"] as const)(
    "%s sends revision/source hashes/idempotency key",
    async (action) => {
      const body = {
        termId: "t",
        expectedRevision: 1,
        policyHash: "a".repeat(64),
        evidenceHash: "b".repeat(64),
      };
      client.post.mockResolvedValue({ data: { data: { revision: 2 } } });
      await api.command("student", action, body, "retry");
      expect(client.post).toHaveBeenLastCalledWith(
        `/defense-results/student/${action}`,
        body,
        { headers: { "Idempotency-Key": "retry" } },
      );
    },
  );
  it("isolates options/list/detail by actor, term and student", () => {
    const q = FinalResultQuerySchema.parse({ termId: "t" });
    expect(keys.options("a")).not.toEqual(keys.options("b"));
    expect(keys.list("a", q)).not.toEqual(keys.list("b", q));
    expect(keys.detail("a", "t", "s")).not.toEqual(
      keys.detail("a", "other", "s"),
    );
    expect(keys.detail("a", "t", "s")).not.toEqual(keys.detail("b", "t", "s"));
    expect(keys.detail("a", "t", "s")).not.toEqual(
      keys.detail("a", "t", "other"),
    );
  });
});
