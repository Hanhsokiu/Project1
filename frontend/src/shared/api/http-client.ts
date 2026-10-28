import axios from "axios";
import {
  clearApiSession,
  getAccessToken,
  getRefreshToken,
  setApiUser,
  setTokens,
} from "./api-session";
export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 20000,
});
httpClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
let refreshTask: Promise<string> | undefined;
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const credentialRequest = [
      "/auth/login",
      "/auth/change-password",
      "/auth/refresh",
    ].some((path) => String(config?.url).endsWith(path));
    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !credentialRequest &&
      getRefreshToken()
    ) {
      config._retried = true;
      let renewed: string | undefined;
      try {
        refreshTask ??= axios
          .post(`${httpClient.defaults.baseURL}/auth/refresh`, {
            refreshToken: getRefreshToken(),
          })
          .then((r) => {
            const value = r.data.data;
            setTokens(value.accessToken);
            setApiUser(value.user);
            return value.accessToken as string;
          })
          .finally(() => {
            refreshTask = undefined;
          });
        renewed = await refreshTask;
      } catch {
        clearApiSession();
      }
      if (renewed) {
        config.headers.Authorization = `Bearer ${renewed}`;
        return httpClient(config);
      }
    }
    if (error.response?.status === 401 && !credentialRequest) clearApiSession();
    // Binary endpoints still return the standard JSON envelope on failure.
    // Axios keeps that envelope as a Blob when responseType is "blob".
    const body = error.response?.data;
    if (
      typeof Blob !== "undefined" &&
      body instanceof Blob &&
      /application\/(?:[\w.-]+\+)?json\b/i.test(body.type)
    ) {
      try {
        error.response.data = JSON.parse(await body.text());
      } catch {
        // Preserve the HTTP status and fallback message for malformed responses.
      }
    }
    const details = error.response?.data?.error;
    const message =
      details?.message ||
      error.response?.data?.message ||
      (error.code === "ERR_NETWORK"
        ? "Không kết nối được máy chủ. Kiểm tra backend và thử lại."
        : error.message);
    const normalized = Object.assign(
      new Error(Array.isArray(message) ? message.join("; ") : message),
      {
        code: details?.code || "NETWORK_ERROR",
        fields: details?.fields,
        status: error.response?.status,
      },
    );
    return Promise.reject(normalized);
  },
);
