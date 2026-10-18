// The site is static; this Worker only handles /ingest/*, a reverse proxy to PostHog (US)
// so analytics come from our own domain and aren't dropped by ad blockers. Everything else
// is served straight from the assets (see run_worker_first in wrangler.jsonc).

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const API_HOST = "us.i.posthog.com";
const ASSET_HOST = "us-assets.i.posthog.com";

async function proxy(request: Request, url: URL) {
  const path = url.pathname.replace(/^\/ingest/, "");
  const host = path.startsWith("/static/") || path.startsWith("/array/") ? ASSET_HOST : API_HOST;
  const headers = new Headers(request.headers);
  // Our cookies are none of PostHog's business; pass the visitor's IP for geolocation.
  headers.delete("cookie");
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  return fetch(`https://${host}${path}${url.search}`, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/ingest/")) return proxy(request, url);
    return env.ASSETS.fetch(request);
  },
};
