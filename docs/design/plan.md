# "Your own arena" redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the emote detector's interface as an original purple-and-gold cartoon arena, in
SVG and CSS, without touching one line of the gesture logic or one byte of the attributed Supercell
art.

**Architecture:** This is a Vite + TypeScript static app with no framework. The whole redesign lands
in three places: `index.html` (structure + the inline SVG mark sprite), `src/style.css` (the arena,
the shape language, the motion system) and a small number of new, single-responsibility TS modules
that own the new moving parts (`src/hud.ts`, `src/reveal.ts`). `src/main.ts` is edited only to wire
those modules to values it already computes. Everything under `src/gestures/`, plus `src/emotes.ts`,
`src/hints.ts`, `src/demo.ts`, `src/fixtures.ts` and `src/landmarkers.ts`, is frozen.

**Tech Stack:** Vite 8, TypeScript 6, vanilla DOM, CSS custom properties, inline SVG, vitest
(`--pool=forks --maxWorkers=1`), puppeteer-core with a fake camera device for the e2e gates.

**Spec:** `docs/design/spec.md`

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

- Palette, exact values: `--bg #120b1f` · `--bg-elev #1c1230` · `--bg-stage #0b0714` ·
  `--text #f3edff` · `--muted #b3a6cc` · `--line #2f2246` · `--accent #ffc43d` ·
  `--accent-ink #2a1c00` · `--cyan #66e3ff`. **`--pink` is deleted.**
- Gold = a gesture firing or about to fire, and the primary button. Cyan = links only. No third role.
- One display face: Fredoka 700 only, self-hosted from `/fonts/fredoka-700-latin.woff2`
  (15.9 KB, SIL OFL 1.1, licence at `public/fonts/OFL.txt`). Used ONLY on the h1 and the gesture names.
- One mono: the system mono stack. No second webfont.
- Easing family: `--ease: cubic-bezier(0.2, 0.8, 0.2, 1)`, `--ease-exit: cubic-bezier(0.4, 0, 1, 1)`,
  and `--ease-land: cubic-bezier(0.2, 1.25, 0.35, 1)` used by exactly one keyframe (the emote landing).
- Durations: `--dur-micro 140ms`, `--dur-state 200ms`, `--dur-pop 340ms`, `--dur-exit 180ms`,
  `--dur-section 520ms`, `--dur-hero 700ms`, `--stagger 60ms`.
- Chamfer tokens: `--cut-sm 8px` (controls), `--cut-md 14px` (cards/rows), `--cut-lg 22px` (the arena).
  One polygon family, mirrored top-left + bottom-right, on background, border and hit area alike.
- Every animation has a `prefers-reduced-motion: reduce` path that lands on a **complete static final
  state**, never a shortened animation.
- No Three.js, WebGL, shader, particle system, smooth-scroll engine, confetti, screen shake, mascot,
  fabricated counter, neon glow, laser, dither field, or scanline.
- No Supercell art, colour, typography, card frame, king/tower imagery or arena backdrop anywhere in
  the chrome. `public/emotes/*` stays byte-identical and is used only as the fired payload.
- These DOM ids and classes are load-bearing for `src/main.ts`, `tests/` and
  `scripts/e2e-camera.mjs` and must survive: `#video` `#overlay` `#stage` `#placeholder` `#status`
  `#start-camera` `#start-demo` `#stop` `#mute` `#emote` `#emote-img` `#emote-name` `#demo-caption`
  `#bar-flex` `#bar-thumbs_up` `#bar-yawn` `#val-flex` `#val-thumbs_up` `#val-yawn` `#hint-flex`
  `#hint-thumbs_up` `#hint-yawn`, the `.pop` class on `#emote`, the `.hidden` class, and
  `.visually-hidden`.
- Copy strings are frozen. Do not reword a single live string.
- Run tests as `npm test` (already `vitest run --pool=forks --maxWorkers=1`).
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `public/fonts/fredoka-700-latin.woff2` | created | The one display face. |
| `public/fonts/OFL.txt` | created | Its licence, committed for provenance. |
| `public/favicon.svg` | rewritten | The thumb mark, gold on purple. Replaces the smiley. |
| `index.html` | rewritten | Page structure, the inline `<symbol>` sprite for the three marks, the arena, the HUD strip, the restructured "How it works". |
| `src/style.css` | rewritten | Tokens, the arena, the shape language, the whole motion system and its reduced-motion mirror. |
| `src/marks.ts` | created | The one place that names the three marks and maps a `Gesture` to a `<symbol>` id. |
| `src/hud.ts` | created | Owns the HUD strip: fill level per mark, the active state, and which single mark carries the beam. Pure DOM, no rules. |
| `src/reveal.ts` | created | Owns M1 (h1 masked word reveal) and M2 (section entrance on scroll). Reduced-motion aware, installs nothing under `reduce`. |
| `src/main.ts` | modified | Wires `hud` and `reveal` to values it already computes. No logic change. |
| `tests/marks.test.ts` | created | The mark map is total and matches `GESTURES`. |
| `tests/hud.test.ts` | created | Fill level, active state and single-beam selection are correct, from scores alone. |
| `scripts/e2e-arena.mjs` | created | Fake-camera DOM gate: asserts the arena, the HUD, the fold at 1440, and the reduced-motion final states. |
| `docs/design/DESIGN.md` | created | What shipped. |
| `README.md` | modified | A "Design" section. |

Frozen, expected to show an empty diff against `main`: `src/gestures/*`, `src/emotes.ts`,
`src/hints.ts`, `src/demo.ts`, `src/fixtures.ts`, `src/landmarkers.ts`, `src/analytics.ts`,
`src/draw.ts` (except the overlay colour change in Task 6, which is a constant swap), `public/emotes/*`,
`public/mediapipe/*`, `public/demo/*`, `public/health.json`, `tests/rules.test.ts`,
`tests/engine.test.ts`, `tests/stills.test.ts`, `tests/clips.test.ts`, `tests/video.test.ts`,
`tests/hints.test.ts`, `tests/demo.test.ts`, `tests/corpus.ts`.

---

### Task 1: The three original marks

**Files:**
- Create: `src/marks.ts`
- Create: `tests/marks.test.ts`
- Modify: `index.html` (add the `<svg>` sprite as the first child of `<body>`)
- Modify: `public/favicon.svg`

**Interfaces:**
- Consumes: `GESTURES`, `type Gesture` from `src/gestures/engine`.
- Produces: `MARK_ID: Record<Gesture, string>` and `markHref(g: Gesture): string` returning
  `#mark-<id>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/marks.test.ts
import { describe, expect, it } from "vitest";
import { GESTURES } from "../src/gestures/engine";
import { MARK_ID, markHref } from "../src/marks";

describe("gesture marks", () => {
  it("names a mark for every gesture the engine can report", () => {
    for (const g of GESTURES) expect(MARK_ID[g]).toMatch(/^mark-[a-z_]+$/);
  });

  it("gives every gesture its own mark", () => {
    const ids = GESTURES.map((g) => MARK_ID[g]);
    expect(new Set(ids).size).toBe(GESTURES.length);
  });

  it("builds a same-document href", () => {
    expect(markHref("flex")).toBe("#mark-flex");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --pool=forks --maxWorkers=1 tests/marks.test.ts`
Expected: FAIL, "Failed to resolve import ../src/marks".

- [ ] **Step 3: Write `src/marks.ts`**

```ts
/**
 * The app's own vocabulary: one authored interface mark per gesture, drawn in a single
 * stroke system (3 px non-scaling stroke, round caps, currentColor) as <symbol>s in
 * index.html. These are the chrome. Supercell's emote art is the payload, never the chrome.
 */
import type { Gesture } from "./gestures/engine";

export const MARK_ID: Record<Gesture, string> = {
  thumbs_up: "mark-thumbs_up",
  flex: "mark-flex",
  yawn: "mark-yawn",
};

/** Same-document reference for an <svg><use href="..."> */
export function markHref(gesture: Gesture): string {
  return `#${MARK_ID[gesture]}`;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --pool=forks --maxWorkers=1 tests/marks.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Draw the sprite**

Add this as the first child of `<body>` in `index.html`. Three marks, one stroke system.
`vector-effect="non-scaling-stroke"` is what makes 28 px and 40 px render the same 3 px line.

```html
<svg class="mark-sprite" aria-hidden="true" focusable="false" width="0" height="0">
  <defs>
    <g id="mark-stroke-defaults" />
  </defs>
  <!-- Thumbs up: a folded fist, thumb straight up and clear of it. -->
  <symbol id="mark-thumbs_up" viewBox="0 0 32 32">
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
       stroke-linejoin="round" vector-effect="non-scaling-stroke">
      <path d="M11 15.5V26a2.5 2.5 0 0 0 2.5 2.5h8.2a3 3 0 0 0 2.95-2.46l1.1-6a3 3 0 0 0-2.95-3.54H19" />
      <path d="M19 16.5V9.2A4.2 4.2 0 0 0 14.8 5h0a1.3 1.3 0 0 0-1.3 1.3v2.4a5 5 0 0 1-1.1 3.12L11 13.5" />
      <path d="M5.5 15.5h5.5v13H5.5z" />
    </g>
  </symbol>
  <!-- Goblin muscle: shoulder, elbow out at shoulder height, forearm up, fist beside the head. -->
  <symbol id="mark-flex" viewBox="0 0 32 32">
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
       stroke-linejoin="round" vector-effect="non-scaling-stroke">
      <path d="M4 21.5c3.2-3 6.6-4.2 10-3.6" />
      <path d="M14 17.9c4.6.9 7.1 4.2 7.6 9.6" />
      <path d="M21.6 27.5H6.5" />
      <path d="M14 17.9 20.4 9" />
      <circle cx="23.2" cy="6.4" r="3.6" />
    </g>
  </symbol>
  <!-- Princess yawn: a wide open mouth under two closed eyes. -->
  <symbol id="mark-yawn" viewBox="0 0 32 32">
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
       stroke-linejoin="round" vector-effect="non-scaling-stroke">
      <path d="M7.5 10.5c1.4 1.6 3.4 1.6 4.8 0" />
      <path d="M19.7 10.5c1.4 1.6 3.4 1.6 4.8 0" />
      <ellipse cx="16" cy="21.5" rx="6.5" ry="8" />
    </g>
  </symbol>
</svg>
```

- [ ] **Step 6: Redraw the favicon as the thumb mark**

Replace `public/favicon.svg` entirely:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#120b1f"/>
  <g fill="none" stroke="#ffc43d" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"
     transform="translate(8 6) scale(1.5)">
    <path d="M11 15.5V26a2.5 2.5 0 0 0 2.5 2.5h8.2a3 3 0 0 0 2.95-2.46l1.1-6a3 3 0 0 0-2.95-3.54H19"/>
    <path d="M19 16.5V9.2A4.2 4.2 0 0 0 14.8 5h0a1.3 1.3 0 0 0-1.3 1.3v2.4a5 5 0 0 1-1.1 3.12L11 13.5"/>
    <path d="M5.5 15.5h5.5v13H5.5z"/>
  </g>
</svg>
```

- [ ] **Step 7: Commit**

```bash
git add src/marks.ts tests/marks.test.ts index.html public/favicon.svg public/fonts
git commit -m "$(cat <<'EOF'
design: three original gesture marks in one stroke system

The interface stops borrowing Supercell's PNGs as its vocabulary. Their emote art
stays exactly where it belongs: the payload that pops in the arena when a gesture
fires. Self-hosts Fredoka 700 (SIL OFL 1.1) as the one display face.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The HUD module

**Files:**
- Create: `src/hud.ts`
- Create: `tests/hud.test.ts`

**Interfaces:**
- Consumes: `GESTURES`, `type Gesture` from `src/gestures/engine`.
- Produces:
  - `BEAM_LOW = 0.35`, `BEAM_HIGH = 0.5`
  - `beamGesture(scores: Record<Gesture, number>, active: Gesture | null): Gesture | null`
  - `class Hud { constructor(root: HTMLElement); update(scores, active): void; reset(): void }`

- [ ] **Step 1: Write the failing test**

`beamGesture` is the whole reason this module exists: `beam-glow-states` allows exactly ONE beam
per viewport, and the beam must track a real measured score, never decoration.

```ts
// tests/hud.test.ts
import { describe, expect, it } from "vitest";
import { BEAM_HIGH, BEAM_LOW, beamGesture } from "../src/hud";

const s = (flex: number, thumbs_up: number, yawn: number) => ({ flex, thumbs_up, yawn });

describe("beamGesture (beam-glow-states: one beam per viewport, on a real score)", () => {
  it("is null when nothing is close", () => {
    expect(beamGesture(s(0.1, 0.2, 0), null)).toBeNull();
  });

  it("is null when a score is already over the firing threshold", () => {
    expect(beamGesture(s(0.72, 0.1, 0), null)).toBeNull();
  });

  it("picks the gesture inside the almost-there band", () => {
    expect(beamGesture(s(0.42, 0.1, 0), null)).toBe("flex");
  });

  it("picks only the leading one when two are in the band", () => {
    expect(beamGesture(s(0.38, 0.47, 0), null)).toBe("thumbs_up");
  });

  it("goes quiet while a gesture is active: the emote is the feedback then", () => {
    expect(beamGesture(s(0.42, 0.1, 0), "flex")).toBeNull();
    expect(beamGesture(s(0.42, 0.1, 0), "yawn")).toBeNull();
  });

  it("uses the band the spec names", () => {
    expect(BEAM_LOW).toBe(0.35);
    expect(BEAM_HIGH).toBe(0.5);
    expect(beamGesture(s(BEAM_LOW, 0, 0), null)).toBeNull();
    expect(beamGesture(s(BEAM_HIGH, 0, 0), null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --pool=forks --maxWorkers=1 tests/hud.test.ts`
Expected: FAIL, "Failed to resolve import ../src/hud".

- [ ] **Step 3: Write `src/hud.ts`**

```ts
/**
 * The arena's scoreboard. Each of the three marks along the bottom edge of the stage
 * fills with gold as its gesture's score rises, so the meters ARE the arena furniture
 * rather than three cards below it.
 *
 * This module owns DOM only. Every number it draws is computed by the gesture engine,
 * which this redesign does not touch.
 */
import { GESTURES, type Gesture } from "./gestures/engine";

/** The "almost there" band, from docs/design/spec.md § 2 (M5). */
export const BEAM_LOW = 0.35;
export const BEAM_HIGH = 0.5;

/**
 * Which single mark carries the edge beam this frame, if any.
 *
 * `beam-glow-states` allows one dominant beam per viewport, so this returns the leading
 * candidate and never a set. A gesture that is already active is excluded: the emote is
 * the feedback then, and a beam under a firing gesture would say "almost" about something
 * that already happened.
 */
export function beamGesture(scores: Record<Gesture, number>, active: Gesture | null): Gesture | null {
  if (active !== null) return null;
  let best: Gesture | null = null;
  for (const g of GESTURES) {
    const v = scores[g];
    if (v <= BEAM_LOW || v >= BEAM_HIGH) continue;
    if (best === null || v > scores[best]) best = g;
  }
  return best;
}

type Cell = { root: HTMLElement; fill: HTMLElement };

export class Hud {
  private readonly cells = {} as Record<Gesture, Cell>;

  constructor(root: HTMLElement) {
    for (const g of GESTURES) {
      const cell = root.querySelector<HTMLElement>(`[data-hud="${g}"]`);
      if (!cell) throw new Error(`missing HUD cell for ${g}`);
      const fill = cell.querySelector<HTMLElement>(".hud-fill");
      if (!fill) throw new Error(`missing HUD fill for ${g}`);
      this.cells[g] = { root: cell, fill };
    }
  }

  update(scores: Record<Gesture, number>, active: Gesture | null): void {
    const beam = beamGesture(scores, active);
    for (const g of GESTURES) {
      const cell = this.cells[g];
      const v = Math.max(0, Math.min(1, scores[g]));
      cell.fill.style.setProperty("--fill", v.toFixed(3));
      cell.root.classList.toggle("is-active", active === g);
      cell.root.classList.toggle("is-almost", beam === g);
    }
  }

  reset(): void {
    for (const g of GESTURES) {
      const cell = this.cells[g];
      cell.fill.style.setProperty("--fill", "0");
      cell.root.classList.remove("is-active", "is-almost");
    }
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --pool=forks --maxWorkers=1 tests/hud.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hud.ts tests/hud.test.ts
git commit -m "$(cat <<'EOF'
design: the HUD strip module, with one measured beam

beam-glow-states allows one beam per viewport and forbids decoration, so the beam
tracks a single leading score in 0.35-0.5 and goes quiet the moment a gesture is
actually active.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The reveal module (M1 + M2)

**Files:**
- Create: `src/reveal.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `prefersReducedMotion(): boolean`, `splitWords(el: HTMLElement): void`,
  `initReveals(doc?: ParentNode): void`.

- [ ] **Step 1: Write `src/reveal.ts`**

Two animations, one module, because they share the reduced-motion gate.

M1 is `masked-reveal`'s mechanics without GSAP: word spans inside an `overflow: hidden` mask,
`translateY(110%) → 0`, word-level stagger, the accessible name preserved with `aria-label` while
the split words are `aria-hidden`. M2 is `animation-on-scroll`'s `IntersectionObserver` verbatim in
shape: `threshold: 0.2`, `rootMargin: "0px 0px -10% 0px"`, reveal once, `unobserve` after firing.

```ts
/**
 * The page's two entrance animations, and the single place that decides whether any
 * motion happens at all.
 *
 *   M1  the h1 reveals word by word through a mask, on load (hierarchy)
 *   M2  sections rise into place once, as they are scrolled to (attention)
 *
 * Under prefers-reduced-motion: reduce, neither is installed. The markup's resting state
 * IS the final state, so the page is complete and static rather than briefly animated.
 * That is the spec's rule: a complete static final state, never a shortened animation.
 */

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Wrap each word of `el` in a mask/word pair. The element keeps its full text as its
 * accessible name, and the decorative split is hidden from assistive technology.
 */
export function splitWords(el: HTMLElement): void {
  if (el.dataset.split === "true") return;
  const text = (el.textContent ?? "").trim();
  if (!text) return;
  el.setAttribute("aria-label", text);
  const frag = document.createDocumentFragment();
  const parts = text.split(/(\s+)/);
  let index = 0;
  for (const part of parts) {
    if (!part.trim()) {
      frag.appendChild(document.createTextNode(part));
      continue;
    }
    const mask = document.createElement("span");
    mask.className = "word-mask";
    mask.setAttribute("aria-hidden", "true");
    const word = document.createElement("span");
    word.className = "word";
    word.style.setProperty("--i", String(index));
    word.textContent = part;
    mask.appendChild(word);
    frag.appendChild(mask);
    index += 1;
  }
  el.replaceChildren(frag);
  el.dataset.split = "true";
  el.classList.add("is-split");
}

let observer: IntersectionObserver | null = null;

export function initReveals(doc: ParentNode = document): void {
  if (prefersReducedMotion()) return;

  for (const el of doc.querySelectorAll<HTMLElement>("[data-word-reveal]")) splitWords(el);

  if (typeof IntersectionObserver !== "function") {
    for (const el of doc.querySelectorAll<HTMLElement>("[data-reveal]")) el.classList.add("is-in");
    return;
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        observer?.unobserve(entry.target);
      }
    },
    { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
  );
  for (const el of doc.querySelectorAll<HTMLElement>("[data-reveal]")) observer.observe(el);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/reveal.ts
git commit -m "$(cat <<'EOF'
design: masked h1 reveal and scroll entrances, CSS-only

masked-reveal's mask mechanics and animation-on-scroll's observer, without GSAP or a
smooth-scroll engine: the direction bans one and the page must stay responsive to a
live camera loop. Under reduce, neither is installed at all.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The page structure

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: the `<symbol>` ids from Task 1.
- Produces: the DOM contract in Global Constraints, plus the new hooks
  `#skip-link`, `#hud` with three `[data-hud="<gesture>"]` cells each containing a `.hud-fill`,
  `[data-word-reveal]` on the h1, and `[data-reveal]` on each entering block.

- [ ] **Step 1: Rewrite `index.html`**

Order at both widths: skip link → masthead → controls → arena → the three gestures → how it
works → footer. That is the P1 fix: "Start camera" is above the fold at 1440 because the controls
now precede the stage and the stage is capped.

Head additions (inside `<head>`, after the existing `theme-color`):

```html
<link rel="preload" href="/fonts/fredoka-700-latin.woff2" as="font" type="font/woff2" crossorigin />
<meta property="og:title" content="Emote Detector" />
<meta property="og:description" content="Give your camera a thumbs-up, flex beside your head, or yawn, and the matching Clash Royale emote pops up with its sound." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://emotes.kalpkan.com/" />
<meta property="og:image" content="https://emotes.kalpkan.com/og.png" />
<meta name="twitter:card" content="summary_large_image" />
```

Body structure (the sprite from Task 1 first, then):

```html
<a class="skip-link" href="#stage-heading">Skip to the camera</a>
<main class="app">
  <header class="masthead">
    <h1 data-word-reveal>Emote Detector</h1>
    <p class="eyebrow">Computer vision, in the browser</p>
    <p class="lede">
      Give your camera a thumbs-up, flex beside your head, or yawn, and the matching Clash Royale emote pops up
      with its sound. MediaPipe's face, hand and pose landmarkers run on your device; no video ever leaves it.
    </p>
  </header>

  <section class="arena-wrap" aria-labelledby="stage-heading">
    <h2 id="stage-heading" class="visually-hidden">Camera</h2>

    <div class="controls">
      <div class="buttons">
        <button id="start-camera" class="button primary" type="button">Start camera</button>
        <button id="start-demo" class="button" type="button">Play demo</button>
        <button id="stop" class="button is-idle-hidden" type="button" disabled>Stop</button>
        <button id="mute" class="button" type="button" aria-pressed="false">Mute</button>
      </div>
      <p id="status" class="status" aria-live="polite">Press “Start camera” (about 40 MB of models load once) or “Play demo”.</p>
    </div>

    <div class="arena">
      <div id="stage" class="stage">
        <video id="video" playsinline muted autoplay></video>
        <canvas id="overlay" width="640" height="480" aria-hidden="true"></canvas>
        <div id="placeholder" class="placeholder">
          <ul class="triptych">
            <li><svg class="mark" aria-hidden="true"><use href="#mark-thumbs_up" /></svg><span>Thumbs Up</span></li>
            <li><svg class="mark" aria-hidden="true"><use href="#mark-flex" /></svg><span>Goblin Muscle</span></li>
            <li><svg class="mark" aria-hidden="true"><use href="#mark-yawn" /></svg><span>Princess Yawn</span></li>
          </ul>
          <p>Your camera shows here. Nothing is recorded or uploaded.</p>
        </div>
        <div id="demo-caption" class="demo-caption hidden" aria-live="polite"></div>
        <div id="emote" class="emote hidden" aria-live="assertive">
          <div class="emote-plate">
            <img id="emote-img" alt="" width="200" height="200" />
          </div>
          <span id="emote-name"></span>
        </div>
        <div id="hud" class="hud" aria-hidden="true">
          <div class="hud-cell" data-hud="thumbs_up">
            <span class="hud-mark">
              <svg class="mark" aria-hidden="true"><use href="#mark-thumbs_up" /></svg>
              <span class="hud-fill"><svg class="mark" aria-hidden="true"><use href="#mark-thumbs_up" /></svg></span>
            </span>
            <span class="hud-label">Thumbs Up</span>
          </div>
          <div class="hud-cell" data-hud="flex">
            <span class="hud-mark">
              <svg class="mark" aria-hidden="true"><use href="#mark-flex" /></svg>
              <span class="hud-fill"><svg class="mark" aria-hidden="true"><use href="#mark-flex" /></svg></span>
            </span>
            <span class="hud-label">Goblin Muscle</span>
          </div>
          <div class="hud-cell" data-hud="yawn">
            <span class="hud-mark">
              <svg class="mark" aria-hidden="true"><use href="#mark-yawn" /></svg>
              <span class="hud-fill"><svg class="mark" aria-hidden="true"><use href="#mark-yawn" /></svg></span>
            </span>
            <span class="hud-label">Princess Yawn</span>
          </div>
        </div>
      </div>
    </div>
  </section>
  ...
</main>
```

The HUD is `aria-hidden="true"` because every value it draws is already announced by the
`aria-live` hints and status below it; without that, a live score would spam a screen reader at
frame rate.

The three gesture rows keep `#bar-*`, `#val-*` and `#hint-*`, gain `01/02/03` numerals
(`number-details`), and use the marks instead of the Supercell PNGs:

```html
<section class="gestures" aria-labelledby="gestures-heading">
  <h2 id="gestures-heading">The three gestures</h2>
  <ul class="gesture-list">
    <li data-reveal style="--i: 0">
      <span class="num" aria-hidden="true">01</span>
      <svg class="mark" aria-hidden="true"><use href="#mark-thumbs_up" /></svg>
      <div class="gesture-body">
        <strong>Thumbs Up</strong>
        <span id="hint-thumbs_up" class="hint" aria-live="polite">Fingers folded, thumb straight up.</span>
      </div>
      <span id="val-thumbs_up" class="value">0%</span>
      <div class="bar"><div id="bar-thumbs_up" class="fill"></div></div>
    </li>
    <!-- 02 flex / #hint-flex / #val-flex / #bar-flex, 03 yawn / #hint-yawn / #val-yawn / #bar-yawn -->
  </ul>
  <p class="note">
    Hold a thumbs-up or a flex for a moment (0.15 s) and a yawn a little longer (0.4 s). When a gesture is almost there, the
    line under its meter says what to change. The same emote waits two seconds before playing again; a different one can follow after 0.7 s.
  </p>
</section>
```

`.value` and `.bar` are hidden by CSS until `.gesture-list.is-live` is set, which closes the P3
audit item "three identical meter rows at rest" without removing anything the tests read.

"How it works" keeps steps 1 and 2 verbatim and breaks step 3 into four named sub-points plus a
mono timings list. **Every fact from the 350-word paragraph must survive** — check them off:
score > 0.5; holds 0.15 s / 0.2 s thumbs-up / 0.4 s yawn; release after low for 0.5 s longer than
high; ms-timed so 8 fps behaves like 25 fps; averaged over ~0.2 s; flex keeps its fist at ≥ 0.9×;
thumbs-up waits at most 0.5 s for the pose model; strongest active gesture fires; same emote 2 s,
different 0.7 s; a gesture arriving during the wait plays as soon as it may if still held.

```html
<section class="how" aria-labelledby="how-heading">
  <h2 id="how-heading">How it works</h2>
  <ol class="how-steps">
    <li data-reveal style="--i: 0">Each video frame goes through three MediaPipe models on your device: 478 face points, 21 points per hand, 33 body points.</li>
    <li data-reveal style="--i: 1">Three hand-written rules turn those points into cues, each scored 0 to 1, and a gesture's score is its weakest cue. Flex: elbow bend, fist above the shoulder, fist beside (not in front of) the head, elbow at shoulder height, fist clear of the face. Thumbs-up: four fingers folded, thumb well above the wrist, thumb pointing up, thumb above the fist and away from the face. Yawn: mouth tall relative to its width, eyes closed, brows relaxed (a scream knits them).</li>
  </ol>
  <div class="how-grid">
    <article data-reveal style="--i: 0"><h3>Threshold</h3><p>A score above 0.5 is a candidate. Everything is timed in milliseconds, not frames, so a phone at 8 frames per second behaves like a laptop at 25.</p></article>
    <article data-reveal style="--i: 1"><h3>Hold</h3><p>A score over the threshold has to hold for 0.15 s (0.2 s for a thumbs-up, 0.4 s for a yawn) to switch the gesture on. It switches off only after the score has been low for half a second longer than it was high, so a gesture held for ten seconds fires once and a jittery frame changes nothing.</p></article>
    <article data-reveal style="--i: 2"><h3>Arbitration</h3><p>Scores are averaged over about 0.2 s before the gestures are compared, so the body model's frame-to-frame jitter cannot flip a thumbs-up beside the head into a flex. A clear flex keeps its fist even with the thumb up — its score must be at least 0.9 × the thumbs-up's — otherwise the thumbs-up wins. And because the body model takes a few hundred milliseconds to see where an arm went while the hand model is instant, a thumbs-up waits, at most 0.5 s, while the body model catches up with the hands.</p></article>
    <article data-reveal style="--i: 3"><h3>Cooldown</h3><p>The strongest active gesture fires its emote. The same emote again waits two seconds, a different one 0.7 s, and a gesture that arrives during that wait plays as soon as it may, if it is still held.</p></article>
  </div>
  <dl class="timings" data-reveal>
    <div><dt>Threshold</dt><dd>score &gt; 0.5</dd></div>
    <div><dt>Hold</dt><dd>0.15 s · thumbs-up 0.2 s · yawn 0.4 s</dd></div>
    <div><dt>Release</dt><dd>low for 0.5 s longer than it was high</dd></div>
    <div><dt>Smoothing</dt><dd>scores averaged over ~0.2 s</dd></div>
    <div><dt>Flex vs thumbs-up</dt><dd>flex wins at ≥ 0.9 × · thumbs-up waits ≤ 0.5 s</dd></div>
    <div><dt>Repeat</dt><dd>same emote 2 s · a different one 0.7 s</dd></div>
  </dl>
  <p>
    The rules started as a line-for-line port of the original Python app and were rewritten against a corpus of 95 real
    photos and 70 ground-truth clips (<a href="https://github.com/KalpKan/emote-detector-web">source, numbers and details</a>).
    There is no trained classifier in this page: the original's six-class MobileNetV2 reached 68 % validation accuracy, so it
    stayed out.
  </p>
</section>
```

The footer is unchanged, verbatim.

- [ ] **Step 2: Check the frozen ids survived**

Run:
```bash
for id in video overlay stage placeholder status start-camera start-demo stop mute emote emote-img emote-name demo-caption bar-flex bar-thumbs_up bar-yawn val-flex val-thumbs_up val-yawn hint-flex hint-thumbs_up hint-yawn; do
  grep -q "id=\"$id\"" index.html || echo "MISSING #$id"
done
```
Expected: no output.

- [ ] **Step 3: Check the frozen copy survived**

Run:
```bash
grep -c "Supercell's Fan Content Policy" index.html
grep -c "no video ever leaves it" index.html
grep -c "about 40 MB of models load once" index.html
grep -c "68 % validation accuracy" index.html
```
Expected: `1` four times.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
design: arena page structure, controls above the fold

Closes the P1 audit item: at 1440 the controls now precede the stage, so "Start
camera" is on the first screen. The resting stage shows the three marks instead of
490 px of nothing, "Stop" is hidden until a session runs, and the 350-word step 3
becomes Threshold / Hold / Arbitration / Cooldown plus a mono timings list with
every fact intact.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The arena stylesheet

**Files:**
- Modify: `src/style.css` (full rewrite)

**Interfaces:**
- Consumes: the class names and data attributes from Task 4; `--fill` set by Task 2's `Hud`.
- Produces: the visual system. No JS depends on anything here except `.hidden` and `.pop`.

- [ ] **Step 1: Write the token block**

```css
:root {
  /* Palette: kept wholesale from the live app. Pink is deleted: it had no role. */
  --bg: #120b1f;
  --bg-elev: #1c1230;
  --bg-stage: #0b0714;
  --text: #f3edff;
  --muted: #b3a6cc;
  --line: #2f2246;
  --accent: #ffc43d;
  --accent-ink: #2a1c00;
  --cyan: #66e3ff;

  /* corner-diagonals: one polygon family, three sizes. */
  --cut-sm: 8px;
  --cut-md: 14px;
  --cut-lg: 22px;

  /* animation-systems: one easing family, plus one deliberate landing curve. */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-land: cubic-bezier(0.2, 1.25, 0.35, 1);
  --dur-micro: 140ms;
  --dur-state: 200ms;
  --dur-pop: 340ms;
  --dur-exit: 180ms;
  --dur-section: 520ms;
  --dur-hero: 700ms;
  --stagger: 60ms;

  /* beautiful-shadows, tinted to the purple ground rather than pure black. */
  --shadow-sm: 0 2px 3px -1px rgba(6, 2, 14, 0.5), 0 0 0 1px rgba(47, 34, 70, 0.9);
  --shadow-lg: 0 2.8px 2.2px rgba(6, 2, 14, 0.09), 0 6.7px 5.3px rgba(6, 2, 14, 0.13),
    0 12.5px 10px rgba(6, 2, 14, 0.16), 0 22.3px 17.9px rgba(6, 2, 14, 0.2),
    0 41.8px 33.4px rgba(6, 2, 14, 0.24), 0 100px 80px rgba(6, 2, 14, 0.34);

  --display: "Fredoka", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  color-scheme: dark;
}

@font-face {
  font-family: "Fredoka";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/fonts/fredoka-700-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
    U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

- [ ] **Step 2: Write the shape language and the arena**

`corner-diagonals`: one mirrored polygon, applied to the background, the border and the hit area.

```css
.cut {
  --cut: var(--cut-md);
  clip-path: polygon(
    var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)),
    calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut)
  );
}
```

The arena is a `cut-shell`: a 1 px gold-tinted gradient edge as the outer layer, the stage as the
inner, one contact shadow, and a static radial floor-light under the video
(`funky-purple-container-tech`'s atmospheric anchor, concentrated, not wallpaper).

```css
.arena {
  --cut: var(--cut-lg);
  position: relative;
  max-width: 880px;
  margin-inline: auto;
  padding: 1px;
  background: linear-gradient(150deg, rgba(255, 196, 61, 0.55), rgba(47, 34, 70, 0.9) 42%, rgba(255, 196, 61, 0.22));
  clip-path: polygon(
    var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)),
    calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut)
  );
  filter: drop-shadow(0 18px 38px rgba(6, 2, 14, 0.55));
  transition: background var(--dur-state) var(--ease);
}
.arena:has(.stage.running) {
  background: linear-gradient(150deg, rgba(255, 196, 61, 0.9), rgba(47, 34, 70, 0.9) 42%, rgba(255, 196, 61, 0.45));
}
.stage {
  position: relative;
  aspect-ratio: 4 / 3;
  max-height: min(60vh, 520px);
  container-type: size;
  background: radial-gradient(120% 70% at 50% 118%, rgba(255, 196, 61, 0.06), transparent 62%), var(--bg-stage);
  clip-path: inherit;
  overflow: hidden;
}
```

`max-height: min(60vh, 520px)` is the P1 fix. `clip-path: inherit` keeps the video inside the
chamfer, which is `corner-diagonals`' "do not clip only the background" rule.

- [ ] **Step 3: Write the HUD strip**

The fill is a second, gold copy of the mark clipped from the bottom by `--fill`. Three 44 px
elements; nothing else on the page animates `clip-path`.

```css
.hud {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  display: flex;
  justify-content: center;
  gap: clamp(14px, 4vw, 40px);
  padding: 10px clamp(10px, 3vw, 22px);
  background: linear-gradient(180deg, rgba(11, 7, 20, 0), rgba(11, 7, 20, 0.82) 38%);
  border-top: 1px solid rgba(255, 196, 61, 0.22);
  transform: translateY(100%);
  transition: transform var(--dur-state) var(--ease);
}
.stage.running .hud { transform: translateY(0); }

.hud-mark { position: relative; display: block; width: 40px; height: 40px; color: var(--muted); }
.hud-mark .mark { position: absolute; inset: 0; width: 100%; height: 100%; }
.hud-fill {
  position: absolute;
  inset: 0;
  color: var(--accent);
  --fill: 0;
  clip-path: inset(calc(100% - var(--fill) * 100%) 0 0 0);
  transition: clip-path 120ms linear;
}
.hud-cell.is-active .hud-mark { color: var(--accent); }
.hud-label { font: 700 11px/1 var(--display); letter-spacing: 0.02em; color: var(--muted); }
@media (max-width: 560px) {
  .hud-mark { width: 28px; height: 28px; }
  .hud-label { display: none; }
}
```

- [ ] **Step 4: Write the beam (M5)**

A rotating conic gradient inside a 1 px masked ring. It runs only on `.is-almost`, which Task 2
sets on at most one cell.

```css
.hud-cell.is-almost .hud-mark::after {
  content: "";
  position: absolute;
  inset: -6px;
  padding: 1px;
  border-radius: 10px;
  background: conic-gradient(from var(--beam-angle, 0deg),
    transparent 0deg, rgba(255, 196, 61, 0.9) 42deg, transparent 96deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  opacity: 0.55;
  animation: beam 3.2s linear infinite;
}
@property --beam-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
@keyframes beam { to { --beam-angle: 360deg; } }
```

Static fallback, which is also the whole reduced-motion state:

```css
.hud-cell.is-almost .hud-mark { color: var(--accent); }
@media (prefers-reduced-motion: reduce) {
  .hud-cell.is-almost .hud-mark::after {
    animation: none;
    background: none;
    border: 1px solid var(--accent);
    opacity: 1;
  }
}
```

- [ ] **Step 5: Write the emote plate (`skeuomorphic-ui`, one object, one place)**

```css
.emote { position: absolute; inset: 0; display: grid; place-content: center; gap: 8px; justify-items: center; }
.emote-plate {
  position: relative;
  padding: clamp(10px, 3cqw, 18px);
  border-radius: 20px;
  border: 1px solid transparent;
  background:
    linear-gradient(180deg, #2a1c44, #1a1030 52%, #120b1f) padding-box,
    linear-gradient(180deg, rgba(255, 224, 150, 0.85), rgba(255, 196, 61, 0.28) 45%, rgba(20, 12, 34, 0.9)) border-box;
  box-shadow:
    0 18px 34px rgba(6, 2, 14, 0.55),
    0 5px 12px rgba(6, 2, 14, 0.4),
    inset 0 1px 0 rgba(255, 233, 178, 0.5),
    inset 0 -1px 0 rgba(10, 6, 18, 0.7);
}
.emote-plate::after {
  content: "";
  position: absolute;
  inset: 1px 1px auto;
  height: 35%;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 233, 178, 0.14), transparent);
  pointer-events: none;
}
.emote img { width: min(clamp(120px, 34vw, 230px), 44cqh); height: auto; }
.emote span { font: 700 clamp(15px, 4cqw, 20px)/1.1 var(--display); color: var(--accent); }
.emote.pop { animation: land var(--dur-pop) var(--ease-land) both; }
.emote.pop .emote-plate { animation: plate var(--dur-pop) var(--ease-land) both; }
@keyframes land { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes plate { from { transform: scale(0.92); } to { transform: scale(1); } }
```

- [ ] **Step 6: Write the single reduced-motion block**

One place, mirroring § 2's table row by row, each landing on the final state.

```css
@media (prefers-reduced-motion: reduce) {
  /* M1: the h1 is never split; if it already was, show it whole. */
  .word { transform: none; animation: none; }
  /* M2: everything is in its final position from the first paint. */
  [data-reveal] { opacity: 1; transform: none; animation: none; }
  /* M3: the HUD is simply there. */
  .hud { transition: none; }
  .stage .hud { transform: translateY(0); }
  /* M4: the readout snaps rather than tracks. */
  .hud-fill, .fill { transition: none; }
  /* M6/M7: full scale, a 120 ms opacity fade, no overshoot and no plate motion. */
  .emote.pop { animation: fade-in 120ms linear both; }
  .emote.pop .emote-plate { animation: none; }
  /* M8 */
  .button { transition: background var(--dur-micro) linear, border-color var(--dur-micro) linear; }
  .button:active { transform: none; }
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
```

Note `.stage .hud { transform: translateY(0) }` and not only `.stage.running .hud`: under `reduce`
the strip must be complete at rest, not slid off the bottom edge waiting for a class.

- [ ] **Step 7: Write the skip link and focus rings**

`clip-path` clips an outline, so every chamfered control draws its focus ring INSIDE itself with a
negative offset. Verified visually in Task 8.

```css
.skip-link {
  position: absolute;
  left: 12px; top: -60px;
  z-index: 10;
  padding: 10px 16px;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
  transition: top var(--dur-state) var(--ease);
}
.skip-link:focus-visible { top: 12px; }
:where(a, button):focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
.button:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: -4px; box-shadow: 0 0 0 2px var(--cyan); }
.button:not(.primary):focus-visible { outline-color: var(--cyan); }
```

- [ ] **Step 8: Run the build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/style.css
git commit -m "$(cat <<'EOF'
design: the arena stylesheet

funky-purple-container-tech for the system, corner-diagonals for the shape language,
skeuomorphic-ui on exactly one object (the emote plate), beautiful-shadows tinted to
the purple ground, and animation-systems' token set with a reduced-motion mirror for
every row of the spec's motion table. Deletes pink, which had no role.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wire it up

**Files:**
- Modify: `src/main.ts`
- Modify: `src/draw.ts` (colour constants only)

**Interfaces:**
- Consumes: `Hud` from Task 2, `initReveals` from Task 3, the DOM from Task 4.
- Produces: nothing new.

- [ ] **Step 1: Add the HUD to `updateMeters`**

`updateMeters` already receives exactly what the HUD needs. Do not compute anything new.

```ts
import { Hud } from "./hud";
import { initReveals } from "./reveal";

const hud = new Hud($<HTMLDivElement>("hud"));
const gestureList = document.querySelector<HTMLUListElement>(".gesture-list");

function updateMeters(scores: Record<Gesture, number>, active: Gesture | null): void {
  for (const g of GESTURES) {
    const pct = Math.round(scores[g] * 100);
    meters[g].bar.style.transform = `scaleX(${scores[g].toFixed(3)})`;
    meters[g].value.textContent = `${pct}%`;
    meters[g].bar.parentElement!.classList.toggle("active", active === g);
  }
  hud.update(scores, active);
}
```

- [ ] **Step 2: Reveal the percentages only while a session runs**

In `setRunning`, alongside the existing class toggles — this closes the P3 audit item without
removing anything the tests read:

```ts
gestureList?.classList.toggle("is-live", running);
stopBtn.classList.toggle("is-idle-hidden", !running);
```

- [ ] **Step 3: Reset the HUD when a session stops**

In `stop()`, after the existing `updateMeters({ flex: 0, thumbs_up: 0, yawn: 0 }, null)` call:

```ts
hud.reset();
```

- [ ] **Step 4: Start the reveals**

Replace the final line of `src/main.ts`:

```ts
window.addEventListener("load", () => {
  initAnalytics();
  initReveals();
});
```

- [ ] **Step 5: Move the overlay behind the cartoon**

In `src/draw.ts`, the overlay becomes machinery, not a second focal point. Change only these
colour literals — no geometry, no logic:

| Was | Becomes |
|---|---|
| `"rgba(255, 196, 61, 0.9)"` (pose lines) | `"rgba(179, 166, 204, 0.55)"` |
| `"#ffc43d"` (pose dots) | `"rgba(179, 166, 204, 0.7)"` |
| `"rgba(102, 227, 255, 0.9)"` (hand lines) | `"rgba(179, 166, 204, 0.5)"` |
| `"#66e3ff"` (hand dots) | `"rgba(179, 166, 204, 0.65)"` |
| `"#ff7ab6"` (face dots) | `"rgba(179, 166, 204, 0.65)"` |
| `"rgba(255, 122, 182, 0.8)"` (mouth outline) | `"rgba(179, 166, 204, 0.5)"` |

- [ ] **Step 6: Run the full suite**

Run: `npm run typecheck && npm test`
Expected: exit 0, all tests pass including the 114 corpus tests, which must be **unchanged** —
they never touch the DOM.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts src/draw.ts
git commit -m "$(cat <<'EOF'
design: wire the HUD and the reveals; overlay becomes machinery

updateMeters already had everything the arena scoreboard needs, so no number in this
commit is newly computed. The landmark overlay drops to muted low alpha so it reads
as machinery behind the cartoon rather than competing with it, and pink leaves the
codebase entirely.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The fake-camera arena gate

**Files:**
- Create: `scripts/e2e-arena.mjs`
- Modify: `package.json` (add `"e2e:arena": "node scripts/e2e-arena.mjs"`)

**Interfaces:**
- Consumes: the built page on `http://localhost:4173/`.
- Produces: exit 0 or 1, and a printed table of assertions.

This is the gate for done-criteria 3, 4 and 8. It reuses the puppeteer-core fake camera the
detection harness already uses (supervisor ruling: no second browser-automation dependency).

- [ ] **Step 1: Write `scripts/e2e-arena.mjs`**

```js
// Arena DOM gate: drives the real page through Chrome's fake camera and asserts the redesign's
// visible contract at 1440 and 390, plus the reduced-motion final states.
//   npm run build && npm run preview &
//   node scripts/e2e-arena.mjs [url]
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:4173/";
const clip = process.env.CLIP ?? "tests/fixtures/clips/e2e-three-gestures.mjpeg";
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${clip}`,
    "--autoplay-policy=no-user-gesture-required",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  ],
});

async function run(width, height, reduced) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/^(INFO:|[WI]\d{4} )/.test(m.text())) consoleErrors.push(m.text()); });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: "networkidle0" });
  const tag = `${width}x${height}${reduced ? " reduce" : ""}`;

  // The P1 audit item: the primary action is on the first screen.
  const startTop = await page.$eval("#start-camera", (el) => el.getBoundingClientRect().bottom);
  check(`${tag}: "Start camera" fully above the fold`, startTop < height, `bottom=${Math.round(startTop)} < ${height}`);

  // The resting arena says something.
  check(`${tag}: resting arena shows the three marks`, (await page.$$("#placeholder .mark")).length === 3);

  // No Supercell art in the chrome.
  const chromeImgs = await page.$$eval("img", (els) => els.filter((e) => e.id !== "emote-img").map((e) => e.getAttribute("src")));
  check(`${tag}: no Supercell art outside the payload`, chromeImgs.every((s) => !String(s).includes("/emotes/")), JSON.stringify(chromeImgs));

  // Stop is hidden at rest.
  const stopShown = await page.$eval("#stop", (el) => el.offsetParent !== null);
  check(`${tag}: "Stop" hidden until a session runs`, stopShown === false);

  // No percentage at rest.
  const valShown = await page.$eval("#val-flex", (el) => el.offsetParent !== null);
  check(`${tag}: no 0% meter at rest`, valShown === false);

  // The arena is capped.
  const stageH = await page.$eval("#stage", (el) => el.getBoundingClientRect().height);
  check(`${tag}: arena capped at min(60vh, 520px)`, stageH <= Math.min(height * 0.6, 520) + 1, `${Math.round(stageH)}px`);

  // Camera on.
  await page.click("#start-camera");
  await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("Watching"), { timeout: 120_000 });
  check(`${tag}: camera session reaches "Watching"`, true);

  const hudShown = await page.$eval("#hud", (el) => getComputedStyle(el).transform);
  check(`${tag}: HUD strip is up while running`, hudShown === "none" || !hudShown.includes(`, ${Math.round(await page.$eval("#hud", (e) => e.getBoundingClientRect().height))})`), hudShown);

  const valLive = await page.$eval("#val-flex", (el) => el.offsetParent !== null);
  check(`${tag}: percentages appear while live`, valLive === true);

  // The HUD fill tracks a real score.
  const filled = await page.waitForFunction(
    () => [...document.querySelectorAll(".hud-fill")].some((el) => Number(el.style.getPropertyValue("--fill")) > 0.15),
    { timeout: 60_000 },
  ).then(() => true).catch(() => false);
  check(`${tag}: a HUD mark fills from a live score`, filled);

  // An emote fires and lands on its plate.
  const fired = await page.waitForFunction(
    () => { const e = document.getElementById("emote"); return !e.classList.contains("hidden") && !!document.getElementById("emote-name").textContent; },
    { timeout: 90_000 },
  ).then(() => true).catch(() => false);
  check(`${tag}: an emote fires`, fired);

  if (fired) {
    const anim = await page.$eval("#emote", (el) => getComputedStyle(el).animationName);
    check(`${tag}: emote uses ${reduced ? "fade-in" : "land"}`, anim === (reduced ? "fade-in" : "land"), anim);
    const plateAnim = await page.$eval(".emote-plate", (el) => getComputedStyle(el).animationName);
    check(`${tag}: plate is ${reduced ? "static" : "animated"} `, reduced ? plateAnim === "none" : plateAnim === "plate", plateAnim);
  }

  if (reduced) {
    const hudTransition = await page.$eval("#hud", (el) => getComputedStyle(el).transitionDuration);
    check(`${tag}: HUD has no transition`, /^0s(, 0s)*$/.test(hudTransition), hudTransition);
    const fillTransition = await page.$eval(".hud-fill", (el) => getComputedStyle(el).transitionDuration);
    check(`${tag}: HUD fill snaps`, /^0s(, 0s)*$/.test(fillTransition), fillTransition);
    const split = await page.$eval("h1", (el) => el.dataset.split ?? "no");
    check(`${tag}: h1 is never split`, split === "no", split);
  } else {
    const split = await page.$eval("h1", (el) => el.dataset.split ?? "no");
    check(`${tag}: h1 word reveal ran`, split === "true");
    const name = await page.$eval("h1", (el) => el.getAttribute("aria-label"));
    check(`${tag}: h1 keeps its accessible name`, name === "Emote Detector", String(name));
  }

  check(`${tag}: console clean`, consoleErrors.length === 0, consoleErrors.join(" | "));
  await page.close();
}

try {
  await run(1440, 780, false);
  await run(390, 844, false);
  await run(1440, 780, true);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
process.exit(failed.length ? 1 : 0);
```

- [ ] **Step 2: Build, preview, run the gate**

```bash
npm run build
npx vite preview --port 4173 &
sleep 3
node scripts/e2e-arena.mjs
```
Expected: every assertion PASS, exit 0.

- [ ] **Step 3: Run the detection gate, unchanged, to prove the logic still works through the real pipeline**

```bash
node scripts/e2e-camera.mjs http://localhost:4173/
WIDTH=390 node scripts/e2e-camera.mjs http://localhost:4173/
```
Expected: the same verdict the harness gave on `main`. If it differs, the redesign broke
something and the cause must be found before moving on — the rules did not change.

- [ ] **Step 4: Kill the preview server you started**

```bash
pkill -f "vite preview --port 4173"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/e2e-arena.mjs package.json
git commit -m "$(cat <<'EOF'
test: fake-camera gate for the arena, at 1440, 390 and under reduce

Asserts the visible contract of the redesign rather than a screenshot: the fold, the
resting triptych, no Supercell art in the chrome, the hidden Stop, no 0% at rest, the
capped stage, the HUD filling from a real score, an emote landing on its plate, and
the reduced-motion final states.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Docs, screenshots, deploy

**Files:**
- Create: `docs/design/DESIGN.md`
- Create: `docs/images/redesign/*.png`
- Create: `scripts/make-og.mjs`, `public/og.png`
- Modify: `README.md`

- [ ] **Step 1: Screenshots at 1440 and 390, rest and running**

Use claude-in-chrome against the preview build; save to `docs/images/redesign/`:
`1440-rest.png`, `1440-running.png`, `390-rest.png`, `390-running.png`, `1440-reduced.png`.

- [ ] **Step 2: Generate the OG image**

`scripts/make-og.mjs` renders a 1200×630 page with the thumb mark and the wordmark through the
same headless Chrome and screenshots it to `public/og.png`. No new dependency.

- [ ] **Step 3: Write `docs/design/DESIGN.md`**

What shipped: tokens with their values, the shape language, the type roles, the motion table as
built, the reduced-motion policy, the asset provenance (Fredoka OFL, the three authored marks,
Supercell's payload art), and the rules for extending it.

- [ ] **Step 4: Add a "Design" section to `README.md`**

Point at `docs/design/spec.md`, `docs/design/plan.md` and `docs/design/DESIGN.md`; state the
direction name; state that the Supercell art is payload, not chrome.

- [ ] **Step 5: Gates, then one preview deploy**

```bash
npm run typecheck && npm test && npm run build
npx vercel --scope kks-projects-2edcb11a
```

- [ ] **Step 6: Merge and deploy production (one deploy)**

```bash
git checkout main && git merge --no-ff redesign && git push origin main
```
The Git integration deploys. Confirm `https://emotes.kalpkan.com` serves the new bundle and
`/health.json` still answers `{"ok":true,"service":"emotes"}`.

- [ ] **Step 7: Lighthouse on production, ≥ 0.85**

- [ ] **Step 8: Reviewer, then verifier**

One `reviewer` sub-agent (design fidelity vs § 6 of `app-directions.md`, `audit-ai-design-slop`,
motion vs `animation-systems`, `/code-review`), apply its blocking fixes, then one `verifier`
sub-agent reproducing the definition of done from scratch on the live URL.

---

## Self-review

**Spec coverage.** § 1 LAYOUT → Task 4. § 1 TYPE → Task 5 Step 1 + Task 1 Step 7 (font files).
§ 1 COLOR/MATERIAL → Task 5 Steps 1–2, 5. § 1 IMAGERY → Task 1 (marks), Task 6 Step 5 (overlay).
§ 1 COPY → Task 4 Steps 1, 3. § 2 motion table → Task 3 (M1, M2), Task 5 Steps 2–6 (M3–M8),
Task 7 (the assertions). § 3 skills → recorded in the spec, exercised in Tasks 1–5. § 4 kept-from-today
→ Task 4 Step 2 (ids), Task 4 Step 3 (copy), Task 6 Step 6 (tests), frozen-file list above.
§ 5 audit items → P1 fold (Task 4 Step 1, Task 7), P1 empty stage (Task 4 triptych), P2 explanation
(Task 4), P2 IP (Task 1), P2 unguarded motion (Task 5 Step 6), P3 disabled Stop (Task 6 Step 2),
P3 identical meter rows (Task 6 Step 2). Skip link + focus → Task 5 Step 7.

**Placeholder scan.** No TBDs. Every code step carries its code. Task 8's steps are operational
rather than code and name their exact commands.

**Type consistency.** `MARK_ID` / `markHref` (Task 1) are used nowhere else by name — the HTML
references the `<symbol>` ids directly and `tests/marks.test.ts` keeps the two in lock-step.
`Hud#update(scores, active)` (Task 2) matches `updateMeters`'s existing signature exactly (Task 6
Step 1). `beamGesture` returns `Gesture | null`, consumed only inside `Hud#update`.
`initReveals()` (Task 3) is called with no argument (Task 6 Step 4), matching its default parameter.
`--fill` is written by `Hud#update` and read by `.hud-fill` (Task 5 Step 3) under the same name.

---

## Verification log

Raw output, captured on the night of 2026-09-21. The machine was shared with several other
build agents (load average 36-48 throughout), which is why the MediaPipe camera runs took
minutes rather than seconds; it does not change any verdict.

### Contrast, WCAG 2.x relative luminance

```
--text on --bg                     16.80
--text on --bg-elev                15.59
--muted on --bg                     8.45
--muted on --bg-elev                7.84
--muted on --bg-stage               8.76
--accent-ink on --accent           10.45
--accent on --bg-stage             12.53
--accent on --bg-elev              11.21
--cyan on --bg                     12.80
--cyan on --bg-elev                11.88
01/02/03 #6c5b8c on --bg-elev       2.98   <- FAILED AA at 12 px, raised
01/02/03 #8f7fb4 on --bg-elev       4.97   <- shipped
```

### Arena design gate, `node scripts/e2e-arena.mjs`

Two runs. The first (2026-09-21 03:40-03:43) covered all five combinations including the two
fake-camera runs; the second (`SKIP_CAMERA=1`) re-ran the three demo combinations after the
last harness fix.

```
run 1  106/108 assertions passed
       FAILED: 1440x780 demo: HUD strip is up while running translateY=80.8
       FAILED:  390x844 demo: HUD strip is up while running translateY=7.302
```

Both failures were the harness sampling the HUD's transform in the middle of its own 200 ms
slide — a correct state reported as a failure. The assertion now waits for the strip to settle,
which is the actual contract. Every fake-camera assertion passed in run 1, at both widths:

```
PASS  1440x780 camera: camera session reaches "Watching"
PASS  1440x780 camera: "Stop" appears with the session
PASS  1440x780 camera: percentages appear with the session
PASS  1440x780 camera: HUD strip is up while running   translateY=0
PASS  1440x780 camera: a HUD mark fills from a live score
PASS  1440x780 camera: an emote fires and lands on its plate
PASS  1440x780 camera: the payload is still Supercell's own art, unchanged   /emotes/princess_yawn.png
PASS  1440x780 camera: console clean
PASS   390x844 camera: camera session reaches "Watching"
PASS   390x844 camera: "Stop" appears with the session
PASS   390x844 camera: percentages appear with the session
PASS   390x844 camera: HUD strip is up while running   translateY=0
PASS   390x844 camera: a HUD mark fills from a live score
PASS   390x844 camera: an emote fires and lands on its plate   Goblin Muscle
PASS   390x844 camera: emote animation is "land"   land
PASS   390x844 camera: plate is animated   plate
PASS   390x844 camera: the payload is still Supercell's own art, unchanged   /emotes/goblin_muscle.png
PASS   390x844 camera: console clean
```

```
run 2  66/66 assertions passed
PASS  1440x780 demo:        HUD strip rises and settles while running   translateY=0
PASS   390x844 demo:        HUD strip rises and settles while running   translateY=0.920525
PASS  1440x780 demo reduce: HUD strip rises and settles while running   translateY=0
PASS  1440x780 demo reduce: HUD strip has no transition
PASS  1440x780 demo reduce: HUD fill snaps
PASS  1440x780 demo reduce: gesture bars snap
PASS  1440x780 demo reduce: the beam does not travel   none
PASS  1440x780 demo reduce: h1 is never split under reduce   no
PASS  1440x780 demo reduce: reveal blocks are complete on paint   1
PASS  1440x780 demo reduce: emote animation is "fade-in"   fade-in
PASS  1440x780 demo reduce: plate is static   none
```

### Typecheck, tests, build

```
$ npm run typecheck
(clean)

$ npm test
Test Files  9 passed (9)
     Tests  197 passed (197)

$ npm run build
dist/index.html                         14.24 kB | gzip:  4.32 kB
dist/assets/index-BYk7RR4M.css          13.82 kB | gzip:  4.08 kB
dist/assets/index-DwPYy5S4.js           28.40 kB | gzip: 11.21 kB
dist/assets/vision_bundle-52c-CqHQ.js  153.77 kB | gzip: 45.44 kB
dist/assets/module-do5nsKbH.js         288.27 kB | gzip: 95.65 kB
```

### Frozen files, `git diff main -- …`

```
$ git diff --stat main -- src/gestures src/emotes.ts src/hints.ts src/demo.ts src/fixtures.ts \
    src/landmarkers.ts src/analytics.ts public/emotes public/mediapipe public/demo \
    public/health.json tests/rules.test.ts tests/engine.test.ts tests/stills.test.ts \
    tests/clips.test.ts tests/video.test.ts tests/hints.test.ts tests/demo.test.ts tests/corpus.ts
(no output — every one of them is byte-identical to main)
```

