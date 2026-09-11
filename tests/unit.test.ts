import { describe, it, expect } from "vitest";
import { toBase62 } from "../src/base62.js";
import { UrlStore, Counter } from "../src/store.js";

describe("base62", () => {
  it("0 -> 0000000", () => expect(toBase62(0)).toBe("0000000"));
  it("61 -> 000000Z, 62 -> 0000010", () => {
    expect(toBase62(61)).toBe("000000Z");
    expect(toBase62(62)).toBe("0000010");
  });
  it("consecutive counter values give distinct 7-char alphanumeric codes", () => {
    const c = new Counter();
    const codes = Array.from({ length: 200 }, () => toBase62(c.nextId()));
    expect(new Set(codes).size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^[0-9a-zA-Z]{7}$/);
  });
});

describe("store", () => {
  it("putIfAbsent returns false for existing key and keeps original", () => {
    const store = new UrlStore();
    const orig = { short_code: "abc", long_url: "https://a.com", created_at: new Date(), expires_at: null };
    expect(store.putIfAbsent(orig)).toBe(true);
    expect(store.putIfAbsent({ ...orig, long_url: "https://b.com" })).toBe(false);
    expect(store.get("abc")?.long_url).toBe("https://a.com");
  });
});
