# Emote Detector (in the browser)

**Live: https://emotes.kalpkan.com**

Give your webcam a thumbs-up, flex beside your head, or yawn, and the matching Clash Royale emote pops up with its sound. Everything runs on your device: MediaPipe's face, hand and pose landmarkers in WebAssembly, three hand-written gesture rules in TypeScript, an image and an MP3. No video, landmark or audio ever leaves the browser, and after the models have loaded the page makes no network requests except anonymous, cookieless visit counts to its own `/ingest` path.

This is a browser port of a Python desktop app (OpenCV + MediaPipe Solutions + pygame + Tkinter) that lives, unchanged, in the private repo `KalpKan/clash-emote-bot-python`.

## What it detects (exactly three things)

| You do | Emote | Rule (ported line for line from the Python app) |
|---|---|---|
| **Thumbs up**: fingers folded, thumb straight up | Thumbs Up | Thumb tip well above the wrist and on its vertical, thumb pointing up, all four fingertips below their middle knuckles (`src/gestures/thumbsUp.ts`, from `_score_thumb_direction` and `_score_thumbs_up`) |
| **Flex**: one arm bent, fist up beside your head | Goblin Muscle | Elbow angle near 60°, wrist above the shoulder, wrist close to the nose or eyes, blended 0.45 / 0.35 / 0.2 (`src/gestures/flex.ts`, from `_score_arm_flex`) |
| **Yawn**: mouth wide open, eyes narrowed | Princess Yawn | Inner-lip gap more than 0.55 of the mouth width and more than 0.2 of the face height, with the eyelid gap under 0.25 of the eye width (`src/gestures/face.ts`, from `_extract_face_metrics` and `_score_yawn`) |

Each rule gives a 0–1 score per frame. A score of 0.5 or more for three frames in a row switches the gesture on; three frames below switches it off (`src/gestures/engine.ts`, the Python app's dwell / cool-down state machine). A strong yawn suppresses the other two, and a raised arm cancels a thumbs-up, as in the original. The strongest active gesture fires its emote, then nothing fires for two seconds.

**What it does not do, honestly.** The Python project also trained a six-class MobileNetV2 image classifier (angry, cover-eyes, dab, flex, thumbs-up, yawn). After five epochs on 19 validation images it reached 68 % validation accuracy, so the Python app only ever enabled the three gestures above through the heuristics, and this page does not ship the classifier at all. There is no emotion recognition, no dab, no cover-eyes. Detection is a set of geometric rules, so lighting, camera angle and how far you stand from the camera all matter; the on-page meters show the live score for each gesture so you can see what the rules are seeing.

One deliberate fix over the Python code: a gesture that disappears from the frame entirely now counts as a miss, so it cannot re-trigger later without holding the pose again.

## How it works

1. `index.html` paints with no ML loaded (about 25 KB of JavaScript). Pressing **Start camera** or **Play demo** lazily imports `@mediapipe/tasks-vision` and loads the runtime and models from this site's own files (`public/mediapipe/`, about 40 MB, cached by the browser after the first visit).
2. Every frame (capped near 25 fps) goes through `FaceLandmarker` (478 points), `HandLandmarker` (21 points, up to two hands) and `PoseLandmarker` lite (33 points), all in `VIDEO` mode.
3. `src/gestures/` turns the points into scores, `GestureEngine` runs the state machine, and `src/main.ts` draws the overlay, shows the emote and plays the sound (`public/emotes/*.mp3`, converted from the original WAVs with ffmpeg at mono 32 kHz 48 kbps, 544–688 KB → 19–24 KB each).
4. **Demo mode** replays hand-built landmark fixtures (the same ones the unit tests use, `src/fixtures.ts`) through the very same engine and draws a stick figure, so visitors without a webcam still see the three emotes fire. There is no video file in demo mode.

The size trade-off: self-hosting the WASM runtime and three models costs about 40 MB on first use, but it keeps the page free of CDNs, offline-capable after load, and fast to paint (the models only download after a click, so Lighthouse measures the page, not the models).

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: 31 fixture tests for the rules, the state machine and the cooldown
npm run build      # tsc + vite build -> dist/
```

Environment variables are listed in `.env.example` (names only). Without `VITE_PUBLIC_POSTHOG_KEY` analytics is simply off.

## Analytics

PostHog (`posthog-js`, imported after the page has loaded) through the first-party `/ingest` rewrite in `vercel.json`, cookieless (`persistence: "memory"`), with all inputs masked. Three custom events, none carrying frames or landmarks: `session_started {source}`, `emote_fired {emote}`, `demo_video_played`.

## Credits and legal

Clash Royale emote art and sounds are © Supercell and are used under [Supercell's Fan Content Policy](https://supercell.com/en/fan-content-policy/). **This project is not affiliated with, endorsed, sponsored, or specifically approved by Supercell and Supercell is not responsible for it.** It is non-commercial: no ads, no payments, no affiliate links. Landmark models and runtime: [MediaPipe Tasks](https://ai.google.dev/edge/mediapipe/solutions/vision) (Apache 2.0). Code in this repo: MIT.

---

## For non-developers: how to run this, deploy this, and where the settings live

### How to run this

Open **https://emotes.kalpkan.com** on a laptop or phone, press **Start camera**, allow the camera, and try a thumbs-up. If you would rather not use the camera, press **Play demo**. To run it on your own computer instead: install Node.js (version 22), open a terminal in this folder, type `npm install` once, then `npm run dev`, and open the address it prints.

### How to deploy this

Nothing to do by hand. The site is a Vercel project called **emotes** connected to this GitHub repository: every push to the `main` branch builds and publishes the site in about a minute. If a build fails, Vercel emails the account, and the previous version stays online. To redeploy the current version without changing anything, open Vercel → project `emotes` → Deployments → the top one → "Redeploy".

### Where the settings live

| Setting | Where |
|---|---|
| The address `emotes.kalpkan.com` | Cloudflare → `kalpkan.com` → DNS: a CNAME record named `emotes` (grey cloud, not proxied). Vercel → project `emotes` → Settings → Domains. |
| Analytics key (`VITE_PUBLIC_POSTHOG_KEY`, `VITE_PUBLIC_POSTHOG_HOST`) | Vercel → project `emotes` → Settings → Environment Variables. Names are in `.env.example`; the values are never in this repository. |
| Visitor numbers | PostHog dashboard "Kalp portfolio" (link in the portfolio repo's `docs/analytics.md`). |
| Health check | https://emotes.kalpkan.com/health.json answers `{"ok":true,"service":"emotes"}`. |
| Emote pictures and sounds | `public/emotes/`. Add a file pair and a row in `src/emotes.ts` plus a rule in `src/gestures/` to add a gesture. |
| Detection thresholds | `src/gestures/*.ts` (numbers are the same as the Python app's). |
