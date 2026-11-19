import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../shared/api/http-client", () => ({
  httpClient: { get: vi.fn(), post: vi.fn() },
}));
import { httpClient } from "../../../shared/api/http-client";
import { finalDefenseApi } from "./api";
beforeEach(() => {
  vi.clearAllMocks();
});
describe("UC17 API adapter", () => {
  it("scopes list requests by selected term and page", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: { data: { items: [], total: 0 } },
    });
    expect(await finalDefenseApi.list("synthetic-term", 2)).toEqual({
      items: [],
      total: 0,
    });
    expect(httpClient.get).toHaveBeenCalledWith("/final-defense", {
      params: { termId: "synthetic-term", page: 2, limit: 20 },
    });
  });
  it("sends PDF and expected revision as multipart using a stable caller idempotency key", async () => {
    vi.mocked(httpClient.post).mockResolvedValue({ data: { success: true } });
    // The Node test runtime supplies Blob/FormData; a browser File is a Blob subtype.
    const file = new Blob(["synthetic-only"], {
      type: "application/pdf",
    }) as File;
    await finalDefenseApi.upload("proposal", 4, file, "stable-upload-key");
    const [, body, config] = vi.mocked(httpClient.post).mock.calls[0];
    expect((body as FormData).get("expectedRevision")).toBe("4");
    expect((body as FormData).get("file")).toBeInstanceOf(Blob);
    expect(config?.headers).toMatchObject({
      "Idempotency-Key": "stable-upload-key",
    });
  });
  it("propagates backend failures and never substitutes demo success", async () => {
    vi.mocked(httpClient.post).mockRejectedValue(
      new Error("UC17_SCHEMA_REQUIRED"),
    );
    await expect(
      finalDefenseApi.decide(
        "proposal",
        {
          expectedRevision: 0,
          reportVersionId: "version",
          status: "CONFIRMED",
        },
        "key",
      ),
    ).rejects.toThrow("UC17_SCHEMA_REQUIRED");
  });
  it("downloads only a version under its owning proposal using the authenticated client", async () => {
    const blob = new Blob(["synthetic-only"]);
    vi.mocked(httpClient.get).mockResolvedValue({ data: blob });
    expect(await finalDefenseApi.download("proposal", "version")).toBe(blob);
    expect(httpClient.get).toHaveBeenCalledWith(
      "/proposals/proposal/final-report/versions/version/pdf",
      { responseType: "blob" },
    );
  });
});
