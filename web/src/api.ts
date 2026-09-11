/**
 * POST /urls with network-failure retry. Retries only when fetch itself
 * rejects (offline/DNS/etc) — a 4xx/5xx response is a real answer from the
 * server and is never retried, since POST /urls is not idempotent (it can
 * mint a new short code on every call).
 */
export type CreateUrlBody = {
  long_url: string;
  custom_alias?: string;
  expires_at?: string;
};

export type CreateUrlOptions = {
  retries?: number;
  delayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createUrl(
  body: CreateUrlBody,
  { retries = 2, delayMs = 200 }: CreateUrlOptions = {},
): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      return await fetch("/urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (attempt >= retries) {
        throw new Error("Network error, please retry");
      }
      await sleep(delayMs * Math.pow(2, attempt));
      attempt += 1;
    }
  }
}
