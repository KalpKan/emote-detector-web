# emotes — design spec: "Your own arena"

Locked 2026-09-21, **before any code**, per MengTo's `design-first-ui-prompting`
("prompt like a design system, not a wish"). This file is the contract the build is
measured against; `docs/design/plan.md` is how it gets built and
`docs/design/DESIGN.md` is what shipped.

Source of the direction: `KalpKan/portfolio` → `docs/design/app-directions.md` § 6 *emotes*,
**PRIMARY direction — "Your own arena"**. The alternate ("Broadcast booth") is explicitly
**not** built: the two carry different grounds, type systems and do-not lists, and
`no-ai-design-slop` warns that blending them produces a reference-mismatch cluster.

---

## 0. The one-line thesis

> A cartoon arena drawn here, in this app's own hand: a purple-and-gold stage where your face is
> the player and the emote is the thing that gets lobbed over the wall.

Everything below exists to serve that sentence. Anything that does not is slop and is cut.

---

## 1. The filled `design-first-ui-prompting` prompt

```text
GOAL
- Fire an emote with a thumbs-up, a flex or a yawn, using three on-device MediaPipe models.
- For: someone who plays Clash Royale, sitting at a laptop, who will try this for ninety seconds
  and either laugh or leave. Also for Kalp, as a computer-vision demo he wants read.
- Success: within five seconds of landing, the visitor knows the three gestures and has pressed
  "Start camera"; within twenty seconds an emote has fired and they have seen why.

FORMAT
- Responsive web, 1440 / 390. Stage capped at min(60vh, 520px), max-width 880px.
- Page gutter 20 (390) / 40 (1440). Page measure 880px.

LAYOUT (wireframe in words)
- Skip link (new; house rule) → masthead → controls → arena → the three gestures → how it works
  → footer.
- Masthead: h1 "Emote Detector" in the display face; the eyebrow
  "COMPUTER VISION, IN THE BROWSER" moves BELOW the h1 as mono provenance; then the two-line lede.
- Controls IMMEDIATELY under the masthead, ABOVE the arena: Start camera (primary), Play demo,
  Stop (hidden until running), Mute. Status line under them.
- Arena: a framed panel with chamfered corners, the video inside, and the three gesture marks
  along the bottom edge as a permanent HUD strip. Each mark fills with gold as its score rises,
  so the meters ARE the arena's scoreboard.
- The fired emote pops centre-stage, large, on a molded badge plate, over the video.
- "The three gestures": three rows of mark + name + hint. No percentage at rest.
- "How it works": steps 1–2 as today, step 3 broken into four named sub-points
  (Threshold / Hold / Arbitration / Cooldown) plus a mono timings list. Every fact kept.
- Footer keeps the Supercell disclosure verbatim.

TYPE SYSTEM
- System stack for prose (unchanged).
- ONE display face: Fredoka 700 ONLY, self-hosted latin subset (15.9 KB woff2, SIL OFL 1.1,
  public/fonts/). Used ONLY for the h1 and the gesture names. This is the one app of the seven
  where a display face is right, because the subject is a cartoon game.
- ONE mono: the system mono stack (ui-monospace / SFMono-Regular / Menlo / Consolas), for the
  eyebrow, the timings, the percentages and the 01/02/03 numerals. Zero extra bytes.
- h1 display 700 clamp(30px, 6vw, 44px), tracking -0.01em, line-height 1.05.
- Gesture names display 700 17px. Lede sans 400 17/1.55. Hints sans 400 14px muted.
- Timings + percentages mono 13px, tabular-nums. Eyebrow mono 11px uppercase, tracking 0.14em.

COLOR + MATERIAL
- Palette kept wholesale — it is the best thing here:
  --bg #120b1f · --bg-elev #1c1230 · --bg-stage #0b0714 · --text #f3edff · --muted #b3a6cc
  --line #2f2246 · --accent #ffc43d · --accent-ink #2a1c00 · --cyan #66e3ff
- DISCIPLINED to one job each:
  gold  = a gesture firing or about to fire, and the primary button. Nothing else.
  cyan  = links only.
  pink  = DELETED. It had no role: it tinted the "almost" border (now gold, which is that
          state's colour) and the face landmark dots (now muted, which is what the overlay is).
- Material: chamfered arena panels with a 1px gold-tinted edge on the stage; flat elevated
  surfaces elsewhere. One contact shadow under the arena. A static radial floor-light under the
  video (gold at 6 %). No glass over the video except the HUD strip's plate.
- Texture: none. The palette is already doing the expressing.

IMAGERY / UI STYLE
- THREE ORIGINAL MARKS drawn for this app in one stroke system (3 px non-scaling stroke,
  round caps/joins, currentColor): a thumb, a flexed arm, an open yawning mouth. Inline SVG
  <symbol> sprite, referenced by <use>. They are the app's vocabulary: HUD strip, gesture rows,
  favicon, OG image.
- The Supercell emote PNG remains, UNCHANGED, as the thing that pops in the arena when a gesture
  fires — content, credited, never chrome, never a logo, never in the favicon.
- The landmark overlay (face mesh / hand points / pose) is drawn in --muted at low alpha so it
  reads as machinery behind the cartoon, not as a second focal point.

COPY (render EXACTLY — every string below is live today and stays verbatim)
- "Emote Detector"
- "Give your camera a thumbs-up, flex beside your head, or yawn, and the matching Clash Royale
  emote pops up with its sound. MediaPipe's face, hand and pose landmarkers run on your device;
  no video ever leaves it."
- "Start camera" / "Play demo" / "Stop" / "Mute" / "Unmute"
- "Press “Start camera” (about 40 MB of models load once) or “Play demo”."
- "Your camera shows here. Nothing is recorded or uploaded."
- "Thumbs Up" / "Fingers folded, thumb straight up."
- "Goblin Muscle" / "Flex: bend one arm, fist up beside your head."
- "Princess Yawn" / "A big yawn: mouth wide, eyes closed."
- "The three gestures" / "How it works"
- Every status, error and hint string in src/main.ts and src/hints.ts.
- The full Supercell Fan Content Policy disclosure, verbatim, in the footer.
- The corpus note: "rewritten against a corpus of 95 real photos and 70 ground-truth clips" and
  "the original's six-class MobileNetV2 reached 68 % validation accuracy, so it stayed out."

CONSTRAINTS
- FONT: system stack + one display 700 (Fredoka) + one mono (system)
- STYLE: original cartoon arena, purple and gold
- MODE: dark only

NEGATIVE PROMPT
- No Three.js, no WebGL, no shader, no particle system. Three MediaPipe models already run per
  frame.
- No Supercell art, colours, typography, card frames, king/tower imagery, or arena backdrops in
  the interface chrome. Their emote is the payload; their brand is not ours.
- No confetti, no screen shake, no chromatic aberration on fire.
- No fabricated "emotes fired today" counter, no leaderboard, no streaks.
- No neon glow on the purple, no laser, no dither field, no scanlines.
- No mascot.
- No smooth-scroll engine (Lenis/Locomotive): the page must stay responsive to a live camera loop.
- No second accent. No pink.
```

---

## 2. Motion system

One easing family, durations from `animation-systems`, a reason per animation, and a complete
static final state under `prefers-reduced-motion: reduce`.

### Tokens

```css
--ease:      cubic-bezier(0.2, 0.8, 0.2, 1);   /* the family. Every transition and entrance. */
--ease-exit: cubic-bezier(0.4, 0.0, 1, 1);     /* exits only, faster, per animation-systems.   */
--ease-land: cubic-bezier(0.2, 1.25, 0.35, 1); /* ONE overshoot, ONE place: the emote landing. */

--dur-micro:   140ms;  /* hover / press                         */
--dur-state:   200ms;  /* UI state change                       */
--dur-pop:     340ms;  /* the emote landing                     */
--dur-exit:    180ms;  /* the emote leaving                     */
--dur-section: 520ms;  /* section entrance                      */
--dur-hero:    700ms;  /* the h1 word reveal                    */
--stagger:      60ms;  /* cards / rows (35ms for hero words)    */
```

`--ease-land` is the single deliberate exception to "avoid bouncy defaults".
`animation-systems` permits bounce when the brand is playful; this brand is a cartoon arena, and
the rule it buys is *one strong authored moment, the rest supporting motion*. It is used by
exactly one keyframe.

### Inventory — every moving thing, its reason, and its reduced-motion landing

| # | Moving thing | Reason (one of: hierarchy / feedback / attention / continuity / polish) | Timing | Under `reduce` |
|---|---|---|---|---|
| M1 | h1 word reveal through a mask, on load | **Hierarchy** — establishes the reading order of the first viewport | 700 ms, stagger 35 ms, `--ease` | Never split. h1 is plain, fully visible, no motion. |
| M2 | Section entrance (gesture rows, how-it-works points, timings) on scroll | **Attention** — guides the eye down a long explanatory page, once | 520 ms, rise 16 px, stagger 60 ms, `--ease` | Observer never installed, and the `reveal-ready` class that hides them is never added; every element is at its final state on paint. |
| M3 | Arena "power on": the gold frame edge brightens and the HUD strip rises from the bottom edge when a session starts | **Feedback + continuity** — confirms the camera or demo is actually live | 200 ms, `--ease` | HUD strip is present at its final position instantly; the edge changes colour with no transition. |
| M4 | HUD mark liquid fill tracking the live score | **It is the data.** The meters ARE the arena's scoreboard | 120 ms linear (a readout tracks, it does not ease) | Fill still updates — it is information, not decoration — but with `transition: none`, so it snaps. |
| M5 | "Almost there" edge beam on the leading HUD mark while `0.35 < score < 0.5` | **Attention** — the app already computes this and already says what to change; the beam makes it legible at arm's length | 3.2 s cycle, opacity 0.55, `--ease` fade-in | Static 1 px gold border + gold mark tint. A complete state, not a shortened animation. |
| M6 | Emote landing on its molded plate | **Feedback** — the payload is thrown, not faded in. The one hero moment | 340 ms, `--ease-land`; rim flash 400 ms | Emote appears at full scale with a 120 ms opacity fade. Plate static, no flash. |
| M7 | Emote leaving | **Continuity** | 180 ms opacity, `--ease-exit` | 120 ms opacity fade. |
| M8 | Button press / hover | **Feedback** | 140 ms, `--ease` | Colour and border change only; no translate. |

**No perpetual loop runs behind content.** M5 is the only looping animation on the page and it is
state-gated on a real measured score, in front of nothing, one at a time. At rest the page is
completely still.

**Performance.** Only `transform`, `opacity`, `clip-path` (three 44 px marks) and `border-color`
animate. No animated blur, no animated shadow, no per-frame layout measurement. The camera loop
is already capped at ~25 fps by `MIN_FRAME_MS`; nothing here adds work to it.

---

## 3. MengTo skills used, and exactly where

| Skill | Where it lands in this build |
|---|---|
| `design-first-ui-prompting` | This file. The § 1 prompt is its skeleton, filled, and locked before any code. |
| `no-ai-design-slop` | Passive gate throughout. Concretely it caused: the deletion of pink (a second accent with no role); the deletion of the three identical 0 % meter rows at rest; the removal of the permanently-disabled "Stop" button from the resting control group; one focal point per viewport (the arena); proximity before containers in the gesture rows; and the refusal to turn the how-it-works points into three icon tiles. |
| `build-awwwards-quality-sites` | Art direction written before coding (this file). Hero is the strongest authored moment. Its asset rule is why the three marks are **authored interface marks** (explicitly permitted) and not model-drawn illustration, and why no stock or generated imagery appears anywhere. |
| `animation-systems` | § 2 entirely: the token set, the durations, the one easing family, the reason-per-animation table, the reduced-motion policy, and the "animate transform/opacity only" rule. |
| `funky-purple-container-tech` | The system. Near-black purple base; one centred max-width master container with visible boundaries; the arena as the framed shell that drives hierarchy; thin frame lines and corner markers; a static radial floor-light under the video as the atmospheric anchor; uppercase mono micro-labels for technical credibility. Its "avoid" list is why the glow is concentrated on the arena instead of washing the page. |
| `skeuomorphic-ui` | **One object, one place**: the emote pop plate. Soft vertical gradient (lighter top, darker bottom), a 1 px reflective gradient border, stacked outer elevation + inset carved depth, a top-edge highlight and a darker lower edge. Transitions inside the skill's 160–240 ms band where they are not the hero beat. Nothing else on the page is skeuomorphic — the skill's own rule against mixing materials. |
| `corner-diagonals` | The shape language: chamfered corners on the arena frame, the primary button, the secondary buttons and the gesture rows, from one `--cut` token family (`--cut-sm: 8px` controls, `--cut-md: 14px` cards/rows, `--cut-lg: 22px` the arena). Mirrored top-left + bottom-right on every surface so it reads as a system. Background, border and hit area all follow the same polygon. Focus rings use `outline-offset: -4px` so the clip cannot eat them. |
| `beam-glow-states` | M5. The skill's React package is not usable in a vanilla-TS app, so its **behaviour** is implemented in CSS: one dominant beam per viewport, restrained strength, slower than a loading beam, the semantic state carried by text and border rather than by the motion, and a static border under reduced motion. |
| `beautiful-shadows` | The elevation scale, translated from its Tailwind arbitrary values into CSS custom properties and tinted to the purple ground rather than pure black (the skill's own "no pure black shadows" rule, via `skeuomorphic-ui`): one shadow strength per component state, `--shadow-sm` on controls, `--shadow-lg` as the arena's single contact shadow. |
| `number-details` | `01 02 03` mono numerals in the gutter of the three gesture rows, low contrast, architectural, never competing with the names. |
| `masked-reveal` | M1, the h1. The skill's mask mechanics (word spans, `overflow: hidden`, `translateY(110%) → 0`, word-level stagger, `aria-label` on the element and `aria-hidden` on the split words, unsplit text visible without JS) implemented in CSS instead of GSAP + ScrollTrigger — the direction bans a smooth-scroll engine and the page must not spend bytes or main-thread time next to a live camera loop. |
| `animation-on-scroll` | M2. The skill's `IntersectionObserver` pattern verbatim in shape: `threshold: 0.2`, `rootMargin: "0px 0px -10% 0px"`, reveal once, `unobserve` after firing — with the reduced-motion early return added. |

**Deliberately NOT used**, per the direction's do-not list: every `threejs*` and `webgl-*` skill,
`ambient-section-particles`, `build-interactive-particle-trail`, `pointer-trail-emitter`,
`shaders-cursor-ripples`, `gooey-blob-system`, `dither-laser-dark-mode`, `webgl-laser`,
`cinematic-gsap-lenis-motion-system` (no smooth-scroll engine), and the alternate direction's
`split-layout-technical` / `container-lines` / `glass-dark-ui`.

---

## 4. Kept from today (non-negotiable)

Verbatim from the direction, plus the engineering that must not move:

- The entire purple / gold / cyan palette.
- Every copy string in § 1 COPY, and every other live string in `src/`.
- The Supercell disclosure and its placement in the footer.
- The `.visually-hidden` class (this repo's is the correct one).
- `aria-live="polite"` on the status and the hints; `aria-live="assertive"` on the emote.
- `aria-hidden` on the overlay canvas.
- `aria-pressed` on Mute, and the mute control existing at all.
- 44 px minimum on every pill button.
- The honest model-size warning ("about 40 MB of models load once").
- The demo path.
- The three gesture names and hints.
- **The gesture logic is untouched.** `src/gestures/*`, `src/emotes.ts`, `src/hints.ts`,
  `src/demo.ts`, `src/fixtures.ts`, `src/landmarkers.ts` must show an empty diff against `main`
  except where a new HUD element needs a value the page already computes.
- **The attributed Supercell art and sounds are untouched.** `public/emotes/*` byte-identical.
- PostHog: `session_started`, `emote_fired`, `demo_video_played`, same props, same contract.
- `/health.json` → `{"ok":true,"service":"emotes"}`.
- Every DOM id the tests and the fake-camera harness read: `#video`, `#overlay`, `#stage`,
  `#placeholder`, `#status`, `#start-camera`, `#start-demo`, `#stop`, `#mute`, `#emote`,
  `#emote-img`, `#emote-name`, `#demo-caption`, `#bar-*`, `#val-*`, `#hint-*`, and the `.pop`
  class the harness watches for.

---

## 5. Audit items this build must close

From `app-directions.md` § 6's audit table:

| P | Item | How this build closes it |
|---|---|---|
| P1 | Primary action below the fold at 1440 | Controls move above the arena at both widths; the arena is capped at `min(60vh, 520px)`. Verified by screenshot at 1440×780. |
| P1 | Empty stage carrying no information | At rest the arena shows the three gesture marks as a triptych with their names, plus the privacy line. The largest element on first paint now says what the app does. |
| P2 | Unreadable 350-word explanation block | Step 3 becomes four named sub-points (Threshold / Hold / Arbitration / Cooldown) plus a mono timings list. Every fact kept. |
| P2 | Interface built from someone else's IP | The three original marks replace the Supercell PNGs everywhere in the chrome. The PNGs remain only as the fired payload. |
| P2 | Unguarded motion | § 2's reduced-motion column, on every animation. |
| P3 | Disabled control reads as broken | "Stop" is hidden until a session is running. |
| P3 | Three identical meter rows at rest | At rest: mark + name + hint, no 0 % bar. Percentages appear only when a session is live. |

Cross-app hygiene from the same document: a skip link (this app has none today), visible
`:focus-visible` on every control, contrast checked at rendered size, and the reduced-motion path
`promptflip` already has.

---

## 6. Acceptance

The build is done when § 5 is closed, § 4 is provably untouched, § 2's table is true of the
shipped CSS, and `STATUS.md`'s checklist is ticked with evidence.
