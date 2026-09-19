# Emote Detector (in the browser)

**Live: https://emotes.kalpkan.com**

Give your webcam a thumbs-up, flex beside your head, or yawn, and the matching Clash Royale emote pops up with its sound. Everything runs on your device: MediaPipe's face, hand and pose landmarkers in WebAssembly, three hand-written gesture rules in TypeScript, an image and an MP3. No video, landmark or audio ever leaves the browser, and after the models have loaded the page makes no network requests except anonymous, cookieless visit counts to its own `/ingest` path.

This is a browser port of a Python desktop app (OpenCV + MediaPipe Solutions + pygame + Tkinter) that lives, unchanged, in the private repo `KalpKan/clash-emote-bot-python`.

## What it detects (exactly three things)

| You do | Emote | Rule (rewritten in FIX round 1 against the photo corpus; every cue is 0–1 and the score is the weakest cue) |
|---|---|---|
| **Thumbs up**: fingers folded, thumb straight up | Thumbs Up | Cues, all relative to the hand's own size so distance from the camera does not matter: `folded` (the four fingers curl at the middle knuckle, or the tip has come back to the wrist), `up` (thumb tip well above the wrist), `upright` (thumb within ~35° of vertical), `clear` (thumb above the folded fingertips; a hand over the face scores nothing) (`src/gestures/thumbsUp.ts`) |
| **Flex**: one arm bent, fist up beside your head | Goblin Muscle | Cues in shoulder widths: `bend` (elbow 35–80°), `height` (fist well above the shoulder), `beside` (fist outside the shoulder line, beside the head rather than in front of the face), `level` (elbow at about shoulder height), `clear` (fist away from the nose and outside the face box). "Outside" is measured away from the other shoulder, so a mirrored or turned body works (`src/gestures/flex.ts`) |
| **Yawn**: mouth wide open, eyes closed | Princess Yawn | Cues: `mouth` (mean inner-lip gap 0.28–0.55 of the mouth width), `eyes` (eye aspect ratio from five lid pairs per eye, shut under 0.06, open over 0.14), `brows` (brow-to-lid distance over the face height: a yawn relaxes the brows, a scream knits them). Every gap is a signed projection on the face's own forehead→chin axis, so a tilted or sideways face measures the same and landmark jitter averages out (`src/gestures/face.ts`) |

Each rule gives a 0–1 score per frame. The engine (`src/gestures/engine.ts`) is timed in milliseconds, not frames: a score of 0.5 or more that holds for 0.15 s (0.4 s for a yawn, because talking is short and a yawn is not) switches the gesture on, and it switches off only once the score has been under 0.35 for half a second longer than it has been over 0.5. So a gesture held for ten seconds fires once, a jittery frame changes nothing, and a phone at 8 frames per second behaves like a laptop at 25. Before the gestures are compared, each raw score (and cue) goes through an exponential average of about 0.2 s (FIX round 2: the lite pose model's wrist landmark jitters frame to frame in VIDEO mode, so a thumbs-up beside the head read as a flex every other frame and the two clocks raced). Then the conflict rules: a strong yawn suppresses the other two; a clear thumbs-up (≥ 0.9, every hand cue there) beats a flex that is not itself clear (< 0.9); otherwise, when both are above the line, the flex wins unless the thumbs-up leads by a wide margin (a flexing fist often has its thumb up). The strongest active gesture fires its emote (`src/emotes.ts` `EmoteGate`): the same emote again waits two seconds, a different one only 0.7 s (the previous sound stops), and an edge that arrives during that wait is kept and plays when the wait ends if the gesture is still held, so thumbs-up → flex → yawn done back to back plays all three. While nothing is active, the engine also reports the weakest cue of the gesture that is closest, and the page writes it under that gesture's meter ("Almost: fold the other four fingers into a fist").

**What it does not do, honestly.** The Python project also trained a six-class MobileNetV2 image classifier (angry, cover-eyes, dab, flex, thumbs-up, yawn). After five epochs on 19 validation images it reached 68 % validation accuracy, so the Python app only ever enabled the three gestures above through the heuristics, and this page does not ship the classifier at all. There is no emotion recognition, no dab, no cover-eyes. Detection is a set of geometric rules, so lighting, camera angle and how far you stand from the camera all matter; the on-page meters show the live score for each gesture so you can see what the rules are seeing.

A gesture that disappears from the frame entirely counts as a miss, so it cannot re-trigger later without holding the pose again.

## How it works

1. `index.html` paints with no ML loaded (about 25 KB of JavaScript). Pressing **Start camera** or **Play demo** lazily imports `@mediapipe/tasks-vision` and loads the runtime and models from this site's own files (`public/mediapipe/`, about 40 MB, cached by the browser after the first visit).
2. Every frame (capped near 25 fps) goes through `FaceLandmarker` (478 points), `HandLandmarker` (21 points, up to two hands) and `PoseLandmarker` lite (33 points), all in `VIDEO` mode.
3. `src/gestures/` turns the points into scores, `GestureEngine` runs the state machine, and `src/main.ts` draws the overlay, shows the emote and plays the sound (`public/emotes/*.mp3`, converted from the original WAVs with ffmpeg at mono 32 kHz 48 kbps, 544–688 KB → 19–24 KB each).
4. **Demo mode** replays hand-built landmark fixtures (the same ones the unit tests use, `src/fixtures.ts`) through the very same engine and draws a stick figure, so visitors without a webcam still see the three emotes fire. There is no video file in demo mode.

The size trade-off: self-hosting the WASM runtime and three models costs about 40 MB on first use, but it keeps the page free of CDNs, offline-capable after load, and fast to paint (the models only download after a click, so Lighthouse measures the page, not the models).

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm run test:unit    # vitest: 65 fixture tests for the rules, the state machine, the hints, the emote gate and the demo replay
npm run test:corpus  # the consumer-grade detection gate on real landmarks: stills, clips and VIDEO-mode reels (see below)
npm test             # both
npm run report       # precision / recall per gesture, false triggers per minute, fire latency
npm run build        # tsc + vite build -> dist/
```

### Detection quality: how it is measured

The unit tests prove the port; they do not prove detection. That is measured on real MediaPipe landmarks (`tests/fixtures/`, extracted with the same `.task` models this site ships):

- **95 labelled photos** (`tests/fixtures/stills/*.json`, landmarks only, never the photos): 15 flexes, 17 thumbs-ups, 21 yawns, and 42 negatives (angry faces, covering the eyes, dabbing). `labels.json` says which are clear positives (37: 13 flexes, 16 thumbs-ups, 8 yawns), which are yawns behind a hand (9), which the landmarkers cannot see at all (6, including one thumbs-up whose out-of-focus hand gives the hand model a garbage result), which are people at rest (9), which are hard negatives (33).
- **70 ground-truth clips** (`tests/fixtures/clips/clips.json`): scripts that hold those stills for a few seconds with transitions and jitter, synthesised to frames by `tests/corpus.ts`; among them a neutral minute, a hard-negative minute, three-in-a-row repeats, and twelve 10-second holds at 25, 12 and 8 fps (one gesture held that long must fire exactly once). Each clip says which emote must fire and when.
- **9 VIDEO-mode reels** (`tests/fixtures/video/*.json`, added in FIX round 2): the site's own three `.task` models run in VIDEO mode (as the page runs them) over the fake-camera clips, sampled at 10 fps. Unlike the IMAGE-mode stills these landmarks jitter frame to frame on a static image, which is exactly what made a thumbs-up beside the head fire Goblin Muscle through the real pipeline while the corpus said 100 %. Reels: the beside-the-head thumbs-up ×4, a flexing fist whose thumb reads as a thumbs-up ×3, thumbs-up → flex → yawn back to back with no rest, the round-1 misses and repeats, a six-gesture sweep, two thumbs at shoulder height ×4, and two hard-negative reels. Rebuild: `python3 scripts/build_e2e_clips.py DIR all`, `/usr/bin/python3 scripts/extract_video_landmarks.py DIR/e2e-<name>.mjpeg DIR/e2e-<name>-labels.json DIR/<name>.json`, `npx vite-node scripts/compact-video-fixture.ts DIR/<name>.json tests/fixtures/video/<name>.json`.
- **A real-video check** (`scripts/e2e-camera.mjs`): headless Chrome with its fake camera fed by a slideshow of the photos (`python3 scripts/build_e2e_clip.py`, needs the photo folder, output git-ignored), judged against `tests/fixtures/clips/e2e-labels.json`; `CLIP=… LABELS=…` plays any clip from `scripts/build_e2e_clips.py`.

The bar (`tests/stills.test.ts`, `tests/clips.test.ts`, `tests/video.test.ts`): per gesture at least 90 % of the clear photos score it and at least 90 % of what scores it is that gesture; every positive clip fires its one emote within 1 s of the pose being reached, with per-gesture emote precision ≥ 95 % and recall ≥ 90 % over the clip set; a minute of sitting, talking and looking around fires nothing; a minute of covering the eyes, dabbing and screaming fires at most once; every VIDEO-mode reel fires each of its events once within 1 s and nothing else, with the hard-negative reels firing nothing. The spec with the full table is `docs/reports/emotes-spec.md` in the `KalpKan/portfolio` repo.

**Numbers today (FIX round 2, 2026-09-19; `npm run report`):** photos: flex precision 100 % / recall 100 %, thumbs-up 100 % / 100 %, yawn 100 % / 100 %; 0 of 9 rest photos and 0 of 33 hard negatives score anything; no occluded or unseen photo scores a wrong gesture. Clips: 70 of 70 pass; per-gesture emote precision and recall 100 %; the neutral minute fires nothing and the hard-negative minute fires nothing; fire latency median 240 ms, p95 500 ms, max 700 ms (the 0.2 s smoothing added about 80 ms to the median and took 260 ms off the worst case). VIDEO-mode reels: 9 of 9 pass, precision and recall 100 % for all three gestures, the two hard-negative reels fire nothing in 53 s, latency from the cut median 500 ms, max 600 ms. Through the real pipeline (headless Chrome, fake camera, the site's own landmarkers, Mac GPU) the official clip fires Thumbs Up, Goblin Muscle and Princess Yawn once each at widths 1000 and 390; the beside-the-head thumbs-up (round-2 D1) fires Thumbs Up 12 times in 12 passes over three runs and Goblin Muscle never (round 1: Goblin Muscle 8 of 13); thumbs-up → flex → yawn with no rest (round-2 D2) fires all three at both widths (round 1 lost the flex); every other reel (hard, hard2, misses, repeat, mirror, sweep, far, three 10 s holds, two thumbs at shoulder height ×4) passes; and the status line changes at most once per 0.9 s (round 1: eight changes in 640 ms). Round-1 numbers, for the record: clip latency median 160 / p95 450 / max 960 ms; baseline before round 1: flex precision 35 %, thumbs-up recall 41 %, yawn recall 56 %, 36 of 58 clips, 12 emotes in the hard-negative minute.

One limit, on purpose: a flexing fist whose thumb the hand model reads as a perfect thumbs-up (`flex-09`) is a flex on the steady photo and in the synthesised clip, but after a hard cut on video the hand model settles a frame or two before the pose model, so the reel `flex09x3` may play Thumbs Up for that hold (its ground truth accepts either); what the engine guarantees is one emote per hold, never two, because a flex that emerges from a thumbs-up still being held takes the hold over silently.

Two labels changed this round, each re-checked against its photo: `yawn-13` is now `occluded` (the hand covers the left half of the mouth; the mesh reads the mouth as nearly closed) and `thumbs_up-05` is now `partial` (the hand fills the frame out of focus with the wrist cut off, and the hand model returns a 21-point set only 5 % of the frame wide). The repeat clip for thumbs-up therefore uses `thumbs_up-14`.

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
