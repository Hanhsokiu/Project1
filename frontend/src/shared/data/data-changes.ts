import { snapshotLookupCache } from "./snapshot-lookup-cache";

export type DraftTicket = { scope: Element; version: number };
export class DraftGuard {
  private versions = new Map<Element, number>();
  private sequence = 0;
  change(scope: Element) {
    this.versions.set(scope, ++this.sequence);
  }
  capture(scope?: Element | null): DraftTicket | undefined {
    const version = scope ? this.versions.get(scope) : undefined;
    return scope && version !== undefined ? { scope, version } : undefined;
  }
  complete(ticket?: DraftTicket) {
    if (ticket && this.versions.get(ticket.scope) === ticket.version)
      this.versions.delete(ticket.scope);
  }
  reset(scope: Element) {
    this.versions.delete(scope);
  }
  clear() {
    this.versions.clear();
  }
  hasUnsavedChanges() {
    for (const scope of this.versions.keys())
      if (!scope.isConnected) this.versions.delete(scope);
    return this.versions.size > 0;
  }
}
export const draftGuard = new DraftGuard();
let lastActionScope: Element | null = null;
export function setActionScope(scope: Element | null) {
  lastActionScope = scope;
}
type WriteConfig = {
  method?: string;
  url?: string;
  _refreshDraft?: DraftTicket;
};
export function isDataWrite(config: WriteConfig) {
  return (
    ["post", "put", "patch", "delete"].includes(
      config.method?.toLowerCase() ?? "",
    ) && !/\/auth\/(login|refresh|logout)(?:\?|$)/.test(config.url ?? "")
  );
}
export type DataChange = { lookupPaths: string[] };
const listeners = new Set<(change: DataChange) => void>();
export function subscribeDataChanges(listener: (change: DataChange) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function captureApiWrite(config: WriteConfig) {
  if (isDataWrite(config))
    config._refreshDraft ??= draftGuard.capture(lastActionScope);
}
export function publishApiWrite(config: WriteConfig) {
  if (!isDataWrite(config)) return;
  const lookupPaths = snapshotLookupCache.invalidateWrite(config.url);
  draftGuard.complete(config._refreshDraft);
  listeners.forEach((listener) => listener({ lookupPaths }));
}
