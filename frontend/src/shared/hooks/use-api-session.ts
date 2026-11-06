import { useSyncExternalStore } from "react";
import {
  apiSessionSnapshot,
  getApiUser,
  subscribeApiSession,
} from "../api/api-session";

export function useApiSession() {
  useSyncExternalStore(subscribeApiSession, apiSessionSnapshot, () => "");
  return getApiUser();
}
