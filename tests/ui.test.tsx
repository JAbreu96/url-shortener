// @vitest-environment jsdom
/**
 * Ports tests/ui.test.ts (vanilla JS UI) onto the React <App />. Same
 * data-testids, same assertions, plus a retry test for web/src/api.ts.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import App from "../web/src/App.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(status: number, data: object) {
  const fetchMock = vi.fn(async () => ({ status, json: async () => data }) as Response);
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  const longUrl = screen.getByTestId("long-url") as HTMLInputElement;
  const customAlias = screen.getByTestId("custom-alias") as HTMLInputElement;
  const expiresAt = screen.getByTestId("expires-at") as HTMLInputElement;
  const submitBtn = screen.getByTestId("submit");
  const submit = async () => {
    fireEvent.click(submitBtn);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  };
  return { fetchMock, longUrl, customAlias, expiresAt, submit };
}

describe("UI", () => {
  it("submit calls fetch POST /urls with correct JSON body", async () => {
    const { fetchMock, longUrl, customAlias, submit } = setup(201, {
      short_url: "http://x/abc",
    });
    fireEvent.change(longUrl, { target: { value: "https://example.com" } });
    fireEvent.change(customAlias, { target: { value: "abc" } });
    await submit();
    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe("/urls");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      long_url: "https://example.com",
      custom_alias: "abc",
    });
  });

  it("201 renders short_url as clickable link", async () => {
    const { longUrl, submit } = setup(201, { short_url: "http://x/abc1234" });
    fireEvent.change(longUrl, { target: { value: "https://example.com" } });
    await submit();
    const link = await screen.findByRole("link");
    expect(link.getAttribute("href")).toBe("http://x/abc1234");
  });

  it.each([409, 400])("%i renders error text", async (status) => {
    const { longUrl, submit } = setup(status, { error: `boom ${status}` });
    fireEvent.change(longUrl, { target: { value: "https://example.com" } });
    await submit();
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe(`boom ${status}`),
    );
  });

  it("datetime-local expires_at converted to ISO before sending", async () => {
    const { longUrl, expiresAt, fetchMock, submit } = setup(201, {
      short_url: "http://x/a",
    });
    fireEvent.change(longUrl, { target: { value: "https://example.com" } });
    fireEvent.change(expiresAt, { target: { value: "2030-01-02T03:04" } });
    await submit();
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.expires_at).toBe(new Date("2030-01-02T03:04").toISOString());
    expect(body.expires_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  });

  it("retries on network failure then succeeds, showing the link", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        status: 201,
        json: async () => ({ short_url: "http://x/retry" }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.change(screen.getByTestId("long-url"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByTestId("submit"));

    const link = await screen.findByRole("link", {}, { timeout: 3000 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(link.getAttribute("href")).toBe("http://x/retry");
  });
});
