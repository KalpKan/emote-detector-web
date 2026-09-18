/**
 * PostHog, following the contract every app on kalpkan.com uses
 * (portfolio repo, docs/analytics.md): cookieless (`persistence: "memory"`),
 * first-party via the /ingest rewrite in vercel.json, autocapture on.
 *
 * Three custom events, none of which ever carries a frame, a landmark or audio:
 *   session_started    { source: "camera" | "demo" }
 *   emote_fired        { emote }
 *   demo_video_played  {}
 *
 * posthog-js is imported lazily after the page has loaded so it never competes
 * with the first paint. Without VITE_PUBLIC_POSTHOG_KEY (local dev, a fork)
 * this is a silent no-op.
 */
type PostHog = typeof import("posthog-js").default;

let client: Promise<PostHog> | null = null;

export function initAnalytics(key: string | undefined = import.meta.env.VITE_PUBLIC_POSTHOG_KEY): void {
  if (client || !key) return;
  client = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "/ingest",
      ui_host: "https://us.posthog.com",
      persistence: "memory",
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      session_recording: { maskAllInputs: true },
      disable_surveys: true,
    });
    return posthog;
  });
  client.catch((err) => console.warn("analytics disabled", err));
}

export type EventName = "session_started" | "emote_fired" | "demo_video_played";

export function capture(event: EventName, props: Record<string, string | number> = {}): void {
  if (!client) return;
  // Per docs/analytics.md: instant + sendBeacon so an event is not lost with the page.
  void client.then((posthog) => posthog.capture(event, props, { send_instantly: true, transport: "sendBeacon" })).catch(() => {});
}
