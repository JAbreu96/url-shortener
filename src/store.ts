/**
 * In-memory URL store + id counter.
 * Swap the Map for Redis (or similar) in production without touching
 * app.ts, as long as the same putIfAbsent/get contract is kept.
 */

export interface UrlRecord {
  short_code: string;
  long_url: string;
  created_at: Date;
  expires_at: Date | null;
}

/**
 * Per-instance record store. Must be created fresh per buildApp() call
 * (not module-level) so separate app instances — e.g. in tests — don't
 * share short codes with a shared Counter's id sequence.
 */
export class UrlStore {
  private records = new Map<string, UrlRecord>();

  /**
   * Inserts a record only if its short_code is not already taken.
   * Returns true if inserted, false if the code was already present
   * (caller must treat false as a real conflict, not retry silently).
   */
  putIfAbsent(record: UrlRecord): boolean {
    if (this.records.has(record.short_code)) {
      return false;
    }
    this.records.set(record.short_code, record);
    return true;
  }

  get(code: string): UrlRecord | undefined {
    return this.records.get(code);
  }
}

/**
 * Monotonic id source for generated short codes.
 * In prod this becomes a Redis INCRBY handed out in blocks of 1000
 * per instance, to avoid a round trip per request.
 */
export class Counter {
  private value = 1;

  nextId(): number {
    return this.value++;
  }
}
