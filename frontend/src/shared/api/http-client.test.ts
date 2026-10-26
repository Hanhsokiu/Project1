import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios, {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { httpClient } from "./http-client";
import { getAccessToken, setTokens } from "./api-session";
const originalAdapter = axios.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ config, data, status, statusText: String(status), headers: {} });
function failure(
  config: InternalAxiosRequestConfig,
  status: number,
  message: string,
) {
  return new AxiosError(
    message,
    "ERR_BAD_REQUEST",
    config,
    undefined,
    response(config, { error: { code: "TEST", message } }, status),
  );
}
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, String(v)),
    removeItem: (k: string) => values.delete(k),
  });
  setTokens("old-access", "refresh-token");
});
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
  vi.unstubAllGlobals();
});
describe("API session error handling", () => {
  it("keeps the session when the current password is incorrect", async () => {
    const adapter: AxiosAdapter = async (config) => {
      throw failure(config, 401, "Mật khẩu hiện tại không đúng");
    };
    await expect(
      httpClient.post("/auth/change-password", {}, { adapter }),
    ).rejects.toThrow("Mật khẩu hiện tại không đúng");
    expect(getAccessToken()).toBe("old-access");
  });
  it("refreshes an expired token for /auth/me and retries successfully", async () => {
    axios.defaults.adapter = async (config) =>
      response(config, {
        data: {
          accessToken: "new-access",
          user: { id: "u", name: "Demo", email: null, roles: ["FACULTY"] },
        },
      });
    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      if (calls++ === 0) throw failure(config, 401, "Expired");
      return response(config, { data: { id: "u" } });
    };
    await expect(
      httpClient.get("/auth/me", { adapter }),
    ).resolves.toMatchObject({ data: { data: { id: "u" } } });
    expect(getAccessToken()).toBe("new-access");
    expect(calls).toBe(2);
  });
  it("preserves renewed credentials when a retried business request fails validation", async () => {
    axios.defaults.adapter = async (config) =>
      response(config, {
        data: {
          accessToken: "renewed",
          user: { id: "u", name: "Demo", email: null, roles: ["FACULTY"] },
        },
      });
    let calls = 0;
    const adapter: AxiosAdapter = async (config) => {
      throw failure(config, calls++ === 0 ? 401 : 422, "Sai thời gian");
    };
    await expect(httpClient.post("/terms", {}, { adapter })).rejects.toThrow(
      "Sai thời gian",
    );
    expect(getAccessToken()).toBe("renewed");
  });
});
