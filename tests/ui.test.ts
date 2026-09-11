// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { HTML } from "../src/ui.js";

function setup(status: number, data: object) {
  const fetchMock = vi.fn(async () => ({ status, json: async () => data }));
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously",
    url: "http://localhost:3000/",
    beforeParse(win) {
      (win as any).fetch = fetchMock;
    },
  });
  const doc = dom.window.document;
  const $ = (id: string) => doc.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
  const submit = async () => {
    $("submit").click();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
  };
  return { dom, $, fetchMock, submit };
}

describe("UI", () => {
  it("submit calls fetch POST /urls with correct JSON body", async () => {
    const { $, fetchMock, submit } = setup(201, { short_url: "http://x/abc" });
    $("long-url").value = "https://example.com";
    $("custom-alias").value = "abc";
    await submit();
    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe("/urls");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ long_url: "https://example.com", custom_alias: "abc" });
  });

  it("201 renders short_url as clickable link", async () => {
    const { $, submit } = setup(201, { short_url: "http://x/abc1234" });
    $("long-url").value = "https://example.com";
    await submit();
    await vi.waitFor(() => expect($("result-link").querySelector("a")).not.toBeNull());
    expect($("result-link").querySelector("a")!.getAttribute("href")).toBe("http://x/abc1234");
  });

  it.each([409, 400])("%i renders error text", async (status) => {
    const { $, submit } = setup(status, { error: `boom ${status}` });
    $("long-url").value = "https://example.com";
    await submit();
    await vi.waitFor(() => expect($("error").textContent).toBe(`boom ${status}`));
  });

  it("datetime-local expires_at converted to ISO before sending", async () => {
    const { $, fetchMock, dom, submit } = setup(201, { short_url: "http://x/a" });
    $("long-url").value = "https://example.com";
    $("expires-at").value = "2030-01-02T03:04";
    await submit();
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.expires_at).toBe(new dom.window.Date("2030-01-02T03:04").toISOString());
    expect(body.expires_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  });
});
