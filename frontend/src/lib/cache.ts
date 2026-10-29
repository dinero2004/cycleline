/**
 * Small in-memory LRU cache with a TTL. Per server instance; swap for Redis when running
 * several replicas so they share hits.
 */
export class TtlCache<T> {
  private map = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly maxEntries = 500,
    private readonly ttlMs = 60 * 60 * 1000,
  ) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert to mark as recently used.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      this.map.delete(this.map.keys().next().value as string);
    }
  }

  clear(): void {
    this.map.clear();
  }
}
