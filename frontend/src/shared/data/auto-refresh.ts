import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  draftGuard,
  setActionScope,
  subscribeDataChanges,
} from "./data-changes";
import {
  getAccessToken,
  getApiUser,
  subscribeApiSession,
} from "../api/api-session";

export const DATA_REFRESH_INTERVAL = 30000;
// Historical snapshots and comparisons are immutable; refresh the current
// context and history list, rather than downloading old content repeatedly.
export function isLiveQuery(query: { queryKey: QueryKey }) {
  return !["proposal-version", "proposal-version-compare"].includes(
    String(query.queryKey[0]),
  );
}
export function installAutoRefresh(
  client: QueryClient,
  doc: Document = document,
  win: Window = window,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  let path = win.location.pathname + win.location.search;
  let accountId = getApiUser()?.id;
  let channel: BroadcastChannel | undefined;
  const refresh = () => {
    timer = undefined;
    if (!getAccessToken()) return;
    const nextPath = win.location.pathname + win.location.search;
    if (nextPath !== path) {
      draftGuard.clear();
      path = nextPath;
    }
    const blocked =
      doc.visibilityState === "hidden" ||
      draftGuard.hasUnsavedChanges() ||
      !!doc.querySelector('[data-refresh-unsaved="true"]');
    pending = blocked;
    // Mark all affected caches stale, but only refetch mounted, enabled queries.
    // Avoid aborting/restarting a request when multiple signals arrive together.
    void client.invalidateQueries(
      { predicate: isLiveQuery, refetchType: blocked ? "none" : "active" },
      { cancelRefetch: false },
    );
  };
  const schedule = () => {
    if (!timer) timer = setTimeout(refresh, 200);
  };
  const scopeOf = (target: EventTarget | null) =>
    target && "closest" in target
      ? (target as Element).closest(
          "form:not([role='search']), [data-refresh-draft]",
        )
      : null;
  const input = (event: Event) => {
    const scope = scopeOf(event.target);
    if (scope) {
      draftGuard.change(scope);
      // A request started just before typing must not replace the draft when it finishes.
      if (client.isFetching())
        void client.cancelQueries({ predicate: isLiveQuery });
    }
  };
  const action = (event: Event) => {
    setActionScope(scopeOf(event.target));
    // React may remove a cancelled modal after the click handler returns.
    if (pending) schedule();
  };
  const reset = (event: Event) => {
    const scope = scopeOf(event.target);
    if (scope) draftGuard.reset(scope);
    schedule();
  };
  const visible = () => {
    if (doc.visibilityState !== "hidden") schedule();
  };
  try {
    if (typeof BroadcastChannel !== "undefined")
      channel = new BroadcastChannel("utc-data-changed-v1");
  } catch {
    /* polling/focus remain available */
  }
  if (channel)
    channel.onmessage = (event) => {
      if (event.data?.kind === "changed") schedule();
    };
  const unsubscribeWrites = subscribeDataChanges(() => {
    schedule();
    channel?.postMessage({ kind: "changed" });
  });
  const unsubscribeSession = subscribeApiSession(() => {
    const next = getApiUser()?.id;
    if (next !== accountId) {
      accountId = next;
      draftGuard.clear();
      setActionScope(null);
      client.clear();
    }
  });
  doc.addEventListener("input", input, true);
  doc.addEventListener("change", input, true);
  doc.addEventListener("submit", action, true);
  doc.addEventListener("click", action, true);
  doc.addEventListener("reset", reset, true);
  doc.addEventListener("visibilitychange", visible);
  win.addEventListener("focus", visible);
  win.addEventListener("online", visible);
  const interval = setInterval(() => {
    if (doc.visibilityState !== "hidden") schedule();
  }, DATA_REFRESH_INTERVAL);
  return () => {
    clearInterval(interval);
    if (timer) clearTimeout(timer);
    unsubscribeWrites();
    unsubscribeSession();
    channel?.close();
    doc.removeEventListener("input", input, true);
    doc.removeEventListener("change", input, true);
    doc.removeEventListener("submit", action, true);
    doc.removeEventListener("click", action, true);
    doc.removeEventListener("reset", reset, true);
    doc.removeEventListener("visibilitychange", visible);
    win.removeEventListener("focus", visible);
    win.removeEventListener("online", visible);
    draftGuard.clear();
    setActionScope(null);
  };
}
