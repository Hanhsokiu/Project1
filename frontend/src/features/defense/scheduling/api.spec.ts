import { beforeEach, describe, expect, it, vi } from "vitest";
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/http-client", () => ({ httpClient: http }));
import { scheduleApi } from "./api";
import { syntheticWorkspace } from "./schedule.fixture";
beforeEach(() => {
  vi.clearAllMocks();
});
describe("UC21 API adapter", () => {
  it("loads terms/workspace and readonly proposals with actor session HTTP client", async () => {
    http.get.mockResolvedValue({ data: { data: syntheticWorkspace() } });
    expect((await scheduleApi.workspace("term")).termId).toBe("term");
    await scheduleApi.terms();
    await scheduleApi.propose("term", ["committee"]);
    expect(http.get).toHaveBeenLastCalledWith("/defense-schedules/proposal", {
      params: { termId: "term", committeeIds: "committee" },
    });
    expect(http.post).not.toHaveBeenCalled();
  });
  it("keeps manual preview separate from save and passes exact stable Idempotency-Key", async () => {
    const body = {} as never;
    http.post.mockResolvedValue({ data: { data: { slots: [] } } });
    await scheduleApi.preview(null, body);
    expect(http.post).toHaveBeenLastCalledWith("/defense-schedules/preview", {
      sessionId: null,
      body,
    });
    await scheduleApi.save(null, body, "same");
    expect(http.post).toHaveBeenLastCalledWith("/defense-schedules", body, {
      headers: { "Idempotency-Key": "same" },
    });
    await scheduleApi.save("s/1", body, "retry");
    expect(http.post.mock.calls[2][0]).toBe("/defense-schedules/s%2F1/update");
    await scheduleApi.assign(body, "batch");
    expect(http.post.mock.calls[3][0]).toBe("/defense-schedules/assignments");
  });
  it.each(["finalize", "publish", "cancel"] as const)(
    "uses explicit %s route",
    async (action) => {
      http.post.mockResolvedValue({ data: { success: true } });
      await scheduleApi.transition(action, {} as never, "key");
      expect(http.post.mock.calls[0][0]).toBe("/defense-schedules/" + action);
    },
  );
  it.each([401, 403, 404, 409])(
    "propagates %i instead of reporting a successful write",
    async (status) => {
      const error = Object.assign(Error("TEST_ONLY"), { status });
      http.post.mockRejectedValue(error);
      await expect(scheduleApi.save(null, {} as never, "key")).rejects.toBe(
        error,
      );
    },
  );
});
