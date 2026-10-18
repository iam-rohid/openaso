// PostHog, loaded after the page is idle. Until the visitor accepts cookies (or if they
// decline), events are captured in cookieless mode: nothing is stored in the browser except
// the consent choice itself. Accepting switches to a persistent anonymous id so returning
// visitors and multi-visit funnels work.

import type { PostHog } from "posthog-js";
import { POSTHOG_KEY } from "../consts";

let ready: Promise<PostHog> | undefined;

export function analytics() {
  ready ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2026-08-30",
      cookieless_mode: "on_reject",
      opt_out_capturing_by_default: true,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      person_profiles: "identified_only",
    });
    return posthog;
  });
  return ready;
}

/** Elements with data-event="name" send that event on click, with their data-os/data-arch. */
document.addEventListener("click", (event) => {
  const el = (event.target as Element | null)?.closest<HTMLElement>("[data-event]");
  if (!el?.dataset.event) return;
  const location =
    el.closest<HTMLElement>("[data-download-cta]")?.dataset.downloadCta ?? window.location.pathname;
  void analytics().then((ph) =>
    ph.capture(el.dataset.event!, {
      os: el.dataset.os,
      arch: el.dataset.arch,
      location,
      href: el instanceof HTMLAnchorElement ? el.href : undefined,
    }),
  );
});

// <details> toggle events don't bubble, so listen in the capture phase.
document.addEventListener(
  "toggle",
  (event) => {
    const el = event.target as HTMLDetailsElement;
    if (el.open && el.dataset.faq)
      void analytics().then((ph) => ph.capture("faq_opened", { question: el.dataset.faq }));
  },
  true,
);

const start = () => void analytics();
if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 3000 });
else setTimeout(start, 1500);
