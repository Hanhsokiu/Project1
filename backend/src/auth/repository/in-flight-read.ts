// Share only concurrent reads. Never retain a result after it has settled:
// the next request must see account locks, permission changes and revocations.
export function inFlightRead<T>(
  pending: Map<string, Promise<T>>,
  key: string,
  read: () => PromiseLike<T>,
): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing;
  const task = Promise.resolve().then(read).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
