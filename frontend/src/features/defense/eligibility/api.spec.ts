import { beforeEach, describe, expect, it, vi } from "vitest";
import { eligibilityApi } from "./api";
import { httpClient } from "../../../shared/api/http-client";
vi.mock("../../../shared/api/http-client", () => ({
  httpClient: { get: vi.fn(), post: vi.fn() },
}));
beforeEach(() => vi.clearAllMocks());
describe("UC18 frontend uses the shared authenticated HTTP client", () => {
  it("forwards term/search/status/pagination and loads the selected member in the same term", async () => {
    const query = {
      termId: "term",
      search: "Nguyễn",
      page: 2,
      limit: 20,
      preview: "MISSING" as const,
    };
    vi.mocked(httpClient.get)
      .mockResolvedValueOnce({ data: { data: { items: [], total: 0 } } })
      .mockResolvedValueOnce({
        data: { data: { termStudentId: "member", termId: "term" } },
      });
    expect((await eligibilityApi.list(query)).items).toEqual([]);
    expect(httpClient.get).toHaveBeenCalledWith("/defense-eligibility", {
      params: query,
    });
    expect((await eligibilityApi.detail("member", "term")).termId).toBe("term");
    expect(httpClient.get).toHaveBeenCalledWith("/defense-eligibility/member", {
      params: { termId: "term" },
    });
  });
  it("loads term options from UC18 rather than DemoDb", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: { data: [{ id: "allowed-term" }] },
    });
    expect(await eligibilityApi.terms()).toEqual([{ id: "allowed-term" }]);
    expect(httpClient.get).toHaveBeenCalledWith("/defense-eligibility/options");
  });
  it("sends idempotency/revision/evidence binding and only resolves after a successful API write", async () => {
    const body = {
      termId: "term",
      expectedRevision: 2,
      evidenceHash: "f".repeat(64),
      reason: "Official review",
    };
    vi.mocked(httpClient.post).mockResolvedValue({
      data: { success: true, data: { revision: 3 } },
    });
    expect(
      await eligibilityApi.review("member", body, "same-key"),
    ).toMatchObject({ success: true });
    expect(httpClient.post).toHaveBeenCalledWith(
      "/defense-eligibility/member/review",
      body,
      { headers: { "Idempotency-Key": "same-key" } },
    );
    vi.mocked(httpClient.post).mockRejectedValueOnce(
      Object.assign(new Error("Stale"), { status: 409 }),
    );
    await expect(
      eligibilityApi.decide(
        "member",
        { ...body, status: "ELIGIBLE" },
        "decision",
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("finalizes an explicit selected roster without silently expanding it to a term", async () => {
    const body = {
      termId: "term",
      reason: "Roster",
      members: [
        {
          termStudentId: "member",
          expectedRevision: 2,
          evidenceHash: "f".repeat(64),
        },
      ],
    };
    vi.mocked(httpClient.post).mockResolvedValue({ data: { success: true } });
    await eligibilityApi.finalize(body, "batch-key");
    expect(httpClient.post).toHaveBeenCalledWith(
      "/defense-eligibility/finalize",
      body,
      { headers: { "Idempotency-Key": "batch-key" } },
    );
  });
});
