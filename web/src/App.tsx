/**
 * URL shortener form. Mirrors the old vanilla UI's data-testids so existing
 * test expectations still apply. Empty optional fields (custom_alias,
 * expires_at) are omitted from the request body rather than sent as "".
 * expires_at is a datetime-local input value (local time, no seconds/zone)
 * and is converted to a full ISO string via `new Date(value).toISOString()`
 * before sending.
 */
import { useState, type FormEvent } from "react";
import { createUrl } from "./api.js";

export default function App() {
  const [longUrl, setLongUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setShortUrl(null);
    setError("");

    const body: { long_url: string; custom_alias?: string; expires_at?: string } = {
      long_url: longUrl,
    };
    if (customAlias) body.custom_alias = customAlias;
    if (expiresAt) body.expires_at = new Date(expiresAt).toISOString();

    try {
      const res = await createUrl(body);
      const data = await res.json();
      if (res.status === 201) {
        setShortUrl(data.short_url);
      } else {
        setError(data.error || "request failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    }
  }

  return (
    <div>
      <h1>URL Shortener</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <input
            data-testid="long-url"
            placeholder="https://example.com"
            required
            value={longUrl}
            onChange={(e) => setLongUrl(e.target.value)}
          />
        </div>
        <div>
          <input
            data-testid="custom-alias"
            placeholder="custom alias (optional)"
            value={customAlias}
            onChange={(e) => setCustomAlias(e.target.value)}
          />
        </div>
        <div>
          <input
            data-testid="expires-at"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <button data-testid="submit" type="submit">
          Shorten
        </button>
      </form>
      <p data-testid="result-link">
        {shortUrl ? <a href={shortUrl}>{shortUrl}</a> : null}
      </p>
      <p data-testid="error" style={{ color: "red" }}>
        {error}
      </p>
    </div>
  );
}
