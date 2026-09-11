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

const records = new Map<string, UrlRecord>();

/**
 * Inserts a record only if its short_code is not already taken.
 * Returns true if inserted, false if the code was already present
 * (caller must treat false as a real conflict, not retry silently).
 */
export function putIfAbsent(record: UrlRecord): boolean {
  if (records.has(record.short_code)) {
    return false;
  }
  records.set(record.short_code, record);
  return true;
}

export function get(code: string): UrlRecord | undefined {
  return records.get(code);
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
