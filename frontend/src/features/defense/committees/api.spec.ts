import { beforeEach, describe, expect, it, vi } from "vitest";
import { committeeApi } from "./api";
import { httpClient } from "../../../shared/api/http-client";
vi.mock("../../../shared/api/http-client", () => ({
  httpClient: { get: vi.fn(), post: vi.fn() },
}));
beforeEach(() => vi.clearAllMocks());
describe("UC19 API uses shared authenticated client and real commit responses", () => {
  it("scopes workspace/options to actual API endpoints and term", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: { data: { termId: "term" } },
    });
    await committeeApi.terms();
    await committeeApi.workspace("term");
    expect(httpClient.get).toHaveBeenCalledWith("/defense-committees/options");
    expect(httpClient.get).toHaveBeenCalledWith(
      "/defense-committees/workspace",
      { params: { termId: "term" } },
    );
  });
  it("requests preview with explicit selections and never posts it automatically", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: { data: { status: "UNSAT", placements: [] } },
    });
    expect((await committeeApi.propose("term", ["one", "two"])).status).toBe(
      "UNSAT",
    );
    expect(httpClient.get).toHaveBeenCalledWith(
      "/defense-committees/allocation",
      { params: { termId: "term", termStudentIds: "one,two" } },
    );
    expect(httpClient.post).not.toHaveBeenCalled();
  });
  it("keeps idempotency, revision and evidence bindings for writes and propagates 409 failures", async () => {
    const body = {
      termId: "term",
      rosterHash: "f".repeat(64),
      expectedRevision: 2,
      reason: "Official finalize",
    };
    vi.mocked(httpClient.post).mockResolvedValueOnce({
      data: { success: true, data: { revision: 3 } },
    });
    expect(
      await committeeApi.finalize("committee", body, "same-key"),
    ).toMatchObject({ success: true });
    expect(httpClient.post).toHaveBeenCalledWith(
      "/defense-committees/committee/finalize",
      body,
      { headers: { "Idempotency-Key": "same-key" } },
    );
    vi.mocked(httpClient.post).mockRejectedValueOnce(
      Object.assign(new Error("Source changed"), { status: 409 }),
    );
    await expect(
      committeeApi.finalize("committee", body, "retry"),
    ).rejects.toMatchObject({ status: 409 });
  });
});
