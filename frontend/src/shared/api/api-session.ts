import type { Account } from "../data/types";
export const AUTH_API = import.meta.env.VITE_AUTH_API === "true";
const USER = "utc-api-user";
const ACCESS = "utc-api-access";
const REFRESH = "utc-api-refresh";
export function getAccessToken() {
  return sessionStorage.getItem(ACCESS);
}
export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH);
}
export function setTokens(access: string, refresh?: string) {
  sessionStorage.setItem(ACCESS, access);
  if (refresh) sessionStorage.setItem(REFRESH, refresh);
}
export function getApiUser(): Account | undefined {
  try {
    return getAccessToken()
      ? JSON.parse(sessionStorage.getItem(USER) || "null") || undefined
      : undefined;
  } catch {
    return undefined;
  }
}
export function setApiUser(
  value: Omit<Account, "password" | "email"> & { email: string | null },
) {
  const user = { ...value, email: value.email || "", password: "" } as Account;
  sessionStorage.setItem(USER, JSON.stringify(user));
  return user;
}
export function clearApiSession() {
  sessionStorage.removeItem(ACCESS);
  sessionStorage.removeItem(REFRESH);
  sessionStorage.removeItem(USER);
  sessionStorage.removeItem("utc-thesis-session");
}
