import { describe, it, expect, afterEach, vi } from "vitest";
import { buildApp } from "../src/app.js";

// One shared app per file; aliases are unique per test so state doesn't collide.
const BASE = "https://sho.rt";
const app = buildApp({ baseUrl: BASE });
const post = (payload: object) => app.inject({ method: "POST", url: "/urls", payload });
const future = () => new Date(Date.now() + 3600_000).toISOString();

afterEach(() => vi.useRealTimers());

describe("POST /urls", () => {
  it("valid long_url -> 201 with short_url, short_code, expires_at null", async () => {
    const res = await post({ long_url: "https://example.com/a" });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.short_url).toBe(`${BASE}/${body.short_code}`);
    expect(typeof body.short_code).toBe("string");
    expect(body.expires_at).toBeNull();
  });

  it("same long_url twice -> different short_codes", async () => {
    const a = (await post({ long_url: "https://example.com/dup" })).json();
    const b = (await post({ long_url: "https://example.com/dup" })).json();
    expect(a.short_code).not.toBe(b.short_code);
  });

  it("malformed long_url -> 400", async () => {
    expect((await post({ long_url: "not a url" })).statusCode).toBe(400);
  });

  it("javascript: long_url -> 400", async () => {
    expect((await post({ long_url: "javascript:alert(1)" })).statusCode).toBe(400);
  });

  it('alias "my-link" -> 400', async () => {
    expect((await post({ long_url: "https://e.com", custom_alias: "my-link" })).statusCode).toBe(400);
  });

  it("alias length 2 and 17 -> 400; 3 and 16 -> 201", async () => {
    expect((await post({ long_url: "https://e.com", custom_alias: "ab" })).statusCode).toBe(400);
    expect((await post({ long_url: "https://e.com", custom_alias: "a".repeat(17) })).statusCode).toBe(400);
    expect((await post({ long_url: "https://e.com", custom_alias: "abc" })).statusCode).toBe(201);
    expect((await post({ long_url: "https://e.com", custom_alias: "b".repeat(16) })).statusCode).toBe(201);
  });

  it("7-char alias -> 400", async () => {
    expect((await post({ long_url: "https://e.com", custom_alias: "abcdefg" })).statusCode).toBe(400);
  });

  it('alias "urls" -> 400', async () => {
    expect((await post({ long_url: "https://e.com", custom_alias: "urls" })).statusCode).toBe(400);
  });

  it("expires_at in the past -> 400", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect((await post({ long_url: "https://e.com", expires_at: past })).statusCode).toBe(400);
  });

  it("taken alias -> 409", async () => {
    expect((await post({ long_url: "https://e.com", custom_alias: "taken1" })).statusCode).toBe(201);
    expect((await post({ long_url: "https://f.com", custom_alias: "taken1" })).statusCode).toBe(409);
  });
});

describe("GET", () => {
  it("generated code -> 302 to long_url", async () => {
    const { short_code } = (await post({ long_url: "https://example.com/gen" })).json();
    const res = await app.inject({ method: "GET", url: `/${short_code}` });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/gen");
  });

  it("custom alias -> 302 to long_url", async () => {
    await post({ long_url: "https://example.com/alias", custom_alias: "myalias1" });
    const res = await app.inject({ method: "GET", url: "/myalias1" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/alias");
  });

  it("unknown code -> 404", async () => {
    expect((await app.inject({ method: "GET", url: "/nope123" })).statusCode).toBe(404);
  });

  it("past expires_at -> 410", async () => {
    const created = await post({ long_url: "https://example.com/exp", custom_alias: "expiring", expires_at: future() });
    expect(created.statusCode).toBe(201);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 3600_000);
    expect((await app.inject({ method: "GET", url: "/expiring" })).statusCode).toBe(410);
  });

  it("GET / -> 200 text/html", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/html/);
  });
});
