// Cache reference lists only. Identity, permissions and workflow state always
// come from their existing API requests; this cache is never persisted.
export const LOOKUP_STALE_TIME = 5 * 60 * 1000;

interface LookupEntry {
  promise: Promise<unknown>;
  expiresAt: number;
}

export class SnapshotLookupCache {
  private token: string | null | undefined;
  private entries = new Map<string, LookupEntry>();

  read<T>(token: string, path: string, load: () => Promise<T>): Promise<T> {
    if (token !== this.token) {
      this.clear();
      this.token = token;
    }
    const cached = this.entries.get(path);
    if (cached && cached.expiresAt > Date.now())
      return cached.promise as Promise<T>;

    const entry: LookupEntry = {
      expiresAt: Infinity,
      promise: Promise.resolve().then(load).then(
        (value) => {
          entry.expiresAt = Date.now() + LOOKUP_STALE_TIME;
          return value;
        },
        (error: unknown) => {
          if (this.entries.get(path) === entry) this.entries.delete(path);
          throw error;
        },
      ),
    };
    this.entries.set(path, entry);
    return entry.promise as Promise<T>;
  }

  invalidateWrite(url = "") {
    const path = new URL(url, "http://local.invalid").pathname;
    const lookup = /\/(semesters|training-systems|departments|research-areas)(?:\/|$)/.exec(path);
    const paths = lookup ? [`/${lookup[1]}`] : [];
    // Creating a term can also create its academic semester.
    if (/\/terms(?:\/|$)/.test(path)) paths.push("/semesters");
    this.invalidate(paths);
    return paths;
  }

  invalidate(paths: readonly string[]) {
    paths.forEach((path) => this.entries.delete(path));
  }

  clear() {
    this.entries.clear();
    this.token = undefined;
  }
}

export const snapshotLookupCache = new SnapshotLookupCache();
