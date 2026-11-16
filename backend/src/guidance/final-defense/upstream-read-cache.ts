/** A producer snapshot may be reused by downstream consumers in one transaction.
 * Never use this for the command's own mutable rows, or across transactions.
 * Keys include producer, actor and term so permissions cannot be combined.
 */
export class UpstreamReadCache {
  private readonly reads = new Map<string, Promise<unknown>>();

  read<T>(producer: string, actor: string, term: string, load: () => Promise<T>): Promise<T> {
    const key = JSON.stringify([producer, actor, term]);
    let value = this.reads.get(key) as Promise<T> | undefined;
    if (!value) {
      value = load();
      this.reads.set(key, value);
      void value.catch(() => { if (this.reads.get(key) === value) this.reads.delete(key); });
    }
    return value;
  }
}
