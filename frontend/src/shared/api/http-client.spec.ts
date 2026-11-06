import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter } from "axios";
vi.mock("./api-session", () => ({
  clearApiSession: vi.fn(),
  getAccessToken: () => undefined,
  getRefreshToken: () => undefined,
  setApiUser: vi.fn(),
  setTokens: vi.fn(),
}));
import { httpClient } from "./http-client";

const original = httpClient.defaults.adapter;
afterEach(() => {
  httpClient.defaults.adapter = original;
});
function failWith(data: Blob, status = 409) {
  const adapter: AxiosAdapter = async (config) => {
    throw new AxiosError(
      "Request failed with status code " + status,
      "ERR_BAD_REQUEST",
      config,
      undefined,
      {
        data,
        status,
        statusText: "Conflict",
        headers: new AxiosHeaders(),
        config,
      },
    );
  };
  httpClient.defaults.adapter = adapter;
}
describe("binary endpoint errors", () => {
  it("shows the business error from a failed PDF request", async () => {
    failWith(
      new Blob(
        [
          JSON.stringify({
            error: {
              code: "STUDENT_PROFILE_NOT_READY",
              message: "Chưa có lớp/ngành đã xác nhận.",
              fields: { className: "required" },
            },
          }),
        ],
        { type: "application/json; charset=utf-8" },
      ),
    );
    await expect(
      httpClient.get("/proposals/p/preview.pdf", { responseType: "blob" }),
    ).rejects.toMatchObject({
      message: "Chưa có lớp/ngành đã xác nhận.",
      code: "STUDENT_PROFILE_NOT_READY",
      status: 409,
      fields: { className: "required" },
    });
  });
  it("preserves the HTTP error when the JSON body is malformed", async () => {
    failWith(new Blob(["not json"], { type: "application/json" }));
    await expect(
      httpClient.get("/proposals/p/dossier.pdf", { responseType: "blob" }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Request failed with status code 409",
    });
  });
  it("returns successful PDF bytes unchanged", async () => {
    const bytes = new Blob(["%PDF-test"], { type: "application/pdf" });
    httpClient.defaults.adapter = async (config) => ({
      data: bytes,
      status: 200,
      statusText: "OK",
      config,
      headers: new AxiosHeaders(),
    });
    const response = await httpClient.get("/proposals/p/dossier.pdf", {
      responseType: "blob",
    });
    expect(response.data).toBe(bytes);
    expect(await response.data.text()).toBe("%PDF-test");
  });
});
