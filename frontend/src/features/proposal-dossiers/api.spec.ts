import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../shared/api/http-client";
import { dossierApi } from "./api";

vi.mock("../../shared/api/http-client", () => ({
  httpClient: { put: vi.fn() },
}));

describe("Dossier student profile API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends only confirmed profile values and expected revision to the scoped proposal endpoint", async () => {
    const view = { proposalId: "proposal /1", studentProfile: { revision: 0 } };
    vi.mocked(httpClient.put).mockResolvedValue({
      data: { success: true, data: view },
    });
    const input = {
      className: "CNTT K63",
      majorName: "Công nghệ thông tin",
      expectedRevision: null,
    };
    expect(await dossierApi.updateStudentProfile("proposal /1", input)).toEqual(
      view,
    );
    expect(httpClient.put).toHaveBeenCalledTimes(1);
    expect(httpClient.put).toHaveBeenCalledWith(
      "/proposals/proposal%20%2F1/dossier/student-profile",
      input,
    );
  });
});
