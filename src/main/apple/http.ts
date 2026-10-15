import pLimit from "p-limit";

/**
 * Apple's public endpoints are free but rate limited (roughly ~20 req/min for the
 * iTunes Search/Lookup API). Each host gets its own concurrency limiter and we
 * retry with exponential backoff on throttling/5xx responses.
 */
const limiters = new Map<string, ReturnType<typeof pLimit>>();
const HOST_CONCURRENCY: Record<string, number> = {
  "itunes.apple.com": 3,
  "search.itunes.apple.com": 6,
};

function limiterFor(url: string) {
  const host = new URL(url).host;
  let limiter = limiters.get(host);
  if (!limiter) {
    limiter = pLimit(HOST_CONCURRENCY[host] ?? 4);
    limiters.set(host, limiter);
  }
  return limiter;
}

export class AppleApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AppleApiError";
  }
}

const RETRYABLE = new Set([403, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function appleFetch(
  url: string,
  init: RequestInit = {},
  { retries = 3 }: { retries?: number } = {},
): Promise<Response> {
  return limiterFor(url)(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) return res;
        if (!RETRYABLE.has(res.status) || attempt === retries) {
          throw new AppleApiError(`Apple API responded ${res.status} for ${url}`, res.status);
        }
        lastError = new AppleApiError(`HTTP ${res.status}`, res.status);
      } catch (err) {
        if (err instanceof AppleApiError && !RETRYABLE.has(err.status ?? 0)) throw err;
        lastError = err;
        if (attempt === retries) break;
      }
      await sleep(800 * 2 ** attempt + Math.random() * 400);
    }
    throw lastError instanceof Error ? lastError : new AppleApiError(`Request failed: ${url}`);
  });
}
