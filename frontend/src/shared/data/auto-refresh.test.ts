import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  installAutoRefresh,
  DATA_REFRESH_INTERVAL,
  isLiveQuery,
} from "./auto-refresh";
import {
  DraftGuard,
  draftGuard,
  captureApiWrite,
  publishApiWrite,
  setActionScope,
  subscribeDataChanges,
} from "./data-changes";
const session = vi.hoisted(() => ({
  id: "one",
  token: "token",
  listeners: new Set<() => void>(),
}));
vi.mock("../api/api-session", () => ({
  getAccessToken: () => session.token,
  getApiUser: () => ({ id: session.id }),
  subscribeApiSession: (fn: () => void) => {
    session.listeners.add(fn);
    return () => session.listeners.delete(fn);
  },
}));
class FakeDocument extends EventTarget {
  visibilityState = "visible";
  querySelector = vi.fn(() => null);
}
class FakeWindow extends EventTarget {
  location = { pathname: "/topic/dossier", search: "" };
}
let clean: undefined | (() => void);
let client: QueryClient;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("BroadcastChannel", undefined);
  session.id = "one";
  session.token = "token";
  draftGuard.clear();
  setActionScope(null);
  client = new QueryClient();
});
afterEach(() => {
  clean?.();
  clean = undefined;
  client.clear();
  session.listeners.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function start() {
  const doc = new FakeDocument(),
    win = new FakeWindow();
  clean = installAutoRefresh(
    client,
    doc as unknown as Document,
    win as unknown as Window,
  );
  return { doc, win, invalidated: vi.spyOn(client, "invalidateQueries") };
}
describe("automatic data refresh", () => {
  it("coalesces successful writes, ignores reads/auth and does not include content in signals", async () => {
    const { invalidated } = start();
    let signals = 0;
    const unsub = subscribeDataChanges(() => signals++);
    publishApiWrite({ method: "get", url: "/students" });
    publishApiWrite({ method: "post", url: "/auth/refresh" });
    expect(signals).toBe(0);
    publishApiWrite({ method: "post", url: "/students" });
    publishApiWrite({
      method: "put",
      url: "/proposals/p/dossier/student-profile",
    });
    expect(signals).toBe(2);
    await vi.advanceTimersByTimeAsync(250);
    expect(invalidated).toHaveBeenCalledTimes(1);
    expect(invalidated.mock.calls[0][0]?.refetchType).toBe("active");
    unsub();
  });
  it("polls only visible pages and refreshes on return/focus/online", async () => {
    const { doc, win, invalidated } = start();
    doc.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(DATA_REFRESH_INTERVAL + 250);
    expect(invalidated).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("focus"));
    win.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(250);
    expect(invalidated).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DATA_REFRESH_INTERVAL);
    expect(invalidated).toHaveBeenCalledTimes(2);
  });
  it("marks caches stale without replacing unsaved drafts and clears only the saved form", async () => {
    const { invalidated } = start();
    const scope = { isConnected: true } as Element;
    draftGuard.change(scope);
    await vi.advanceTimersByTimeAsync(DATA_REFRESH_INTERVAL + 250);
    expect(invalidated.mock.calls.at(-1)?.[0]?.refetchType).toBe("none");
    setActionScope(scope);
    const config = { method: "patch", url: "/auth/profile" };
    captureApiWrite(config);
    publishApiWrite(config);
    await vi.advanceTimersByTimeAsync(250);
    expect(invalidated.mock.calls.at(-1)?.[0]?.refetchType).toBe("active");
  });
  it("preserves additional typing during an in-flight save, ignores closed forms and resets on navigation", async () => {
    const { win, invalidated } = start();
    const scope = { isConnected: true } as Element;
    draftGuard.change(scope);
    setActionScope(scope);
    const config = { method: "patch", url: "/auth/profile" };
    captureApiWrite(config);
    draftGuard.change(scope);
    publishApiWrite(config);
    await vi.advanceTimersByTimeAsync(250);
    expect(invalidated.mock.calls.at(-1)?.[0]?.refetchType).toBe("none");
    win.location.pathname = "/terms";
    win.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(250);
    expect(invalidated.mock.calls.at(-1)?.[0]?.refetchType).toBe("active");
    const guard = new DraftGuard();
    guard.change({ isConnected: false } as Element);
    expect(guard.hasUnsavedChanges()).toBe(false);
  });
  it("clears account-specific caches on user changes and stops after cleanup", async () => {
    const { invalidated } = start();
    client.setQueryData(["proposal-dossier", "p"], { private: "old-user" });
    session.id = "two";
    session.listeners.forEach((fn) => fn());
    expect(client.getQueryData(["proposal-dossier", "p"])).toBeUndefined();
    clean?.();
    clean = undefined;
    publishApiWrite({ method: "post", url: "/students" });
    await vi.advanceTimersByTimeAsync(DATA_REFRESH_INTERVAL * 2);
    expect(invalidated).not.toHaveBeenCalled();
  });
  it("refetches mounted queries after a write but leaves immutable snapshots unchanged", async () => {
    start();
    let current = 1;
    const observer = new QueryObserver(client, {
      queryKey: ["proposal-dossier", "p"],
      queryFn: async () => current,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(client.getQueryData(["proposal-dossier", "p"])).toBe(1);
    const history = client
      .getQueryCache()
      .build(client, {
        queryKey: ["proposal-version", "p", "old"],
        queryFn: async () => 1,
      });
    expect(isLiveQuery(history)).toBe(false);
    current = 2;
    publishApiWrite({ method: "post", url: "/proposals/p/finalize" });
    await vi.advanceTimersByTimeAsync(250);
    expect(client.getQueryData(["proposal-dossier", "p"])).toBe(2);
    unsubscribe();
  });
});
