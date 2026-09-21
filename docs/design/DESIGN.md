# DESIGN.md — Emote Detector, "Your own arena"

What shipped, derived from the built page rather than from intentions. The contract this was
built against is `docs/design/spec.md`; how it was built is `docs/design/plan.md`.

> **Visual thesis.** A cartoon arena drawn here, in this app's own hand: a purple-and-gold stage
> where your face is the player and the emote is the thing that gets lobbed over the wall.

Sibling of KalpOS (`kalpkan.com`), not a clone of it. It inherits the restraint and the rule that
"live" means *measured*; it does not inherit the paper ground, the frost or the cyan, because this
app's subject is a cartoon game and its palette already belonged to it.

---

## 1. Colour

Nine tokens, in `src/style.css` `:root`. The palette is unchanged from the app's first version —
it was the best thing about it. What changed is that every colour now has exactly one job.

| Token | Value | Job |
|---|---|---|
| `--bg` | `#120b1f` | The page. |
| `--bg-elev` | `#1c1230` | Buttons, gesture rows, the four how-it-works panels. |
| `--bg-stage` | `#0b0714` | Inside the arena, behind the video. |
| `--text` | `#f3edff` | Headings, names, values. |
| `--muted` | `#b3a6cc` | Prose, hints, the status line, and the landmark overlay. |
| `--line` | `#2f2246` | Every 1 px rule and panel edge that is not the arena. |
| `--accent` | `#ffc43d` | **Gold is the arena**: its frame, its corner brackets, its floor-light, the marks it shows at rest, and any gesture firing or about to fire inside it. Outside the arena, only the primary button that starts a session and the "almost" state on a gesture row. Never a section heading, an eyebrow or a numeral. |
| `--accent-ink` | `#2a1c00` | Text on gold. 10.45:1. |
| `--cyan` | `#66e3ff` | **Links, the skip link, and the focus ring. Nothing else.** |

**`--pink` was deleted.** It had tinted the "almost" border (now gold, because gold is that state's
colour) and the face landmark dots (now muted, because the overlay is machinery). A second accent
with no role is the clearest single symptom of a generic page.

Dark only. There is no light mode and no theme toggle: the arena is a lit stage in a dark room.

### Contrast, at rendered size

Computed with the WCAG 2.x relative-luminance formula (`docs/design/plan.md` § Verification log
has the script's raw output). Every pair is AA or better at its rendered size.

| Pair | Ratio |
|---|---|
| `--text` on `--bg` | 16.80:1 |
| `--text` on `--bg-elev` | 15.59:1 |
| `--muted` on `--bg` | 8.45:1 |
| `--muted` on `--bg-elev` | 7.84:1 |
| `--muted` on `--bg-stage` | 8.76:1 |
| `--accent-ink` on `--accent` | 10.45:1 |
| `--accent` on `--bg-stage` | 12.53:1 |
| `--accent` on `--bg-elev` | 11.21:1 |
| `--cyan` on `--bg` | 12.80:1 |
| `--cyan` on `--bg-elev` | 11.88:1 |
| `01/02/03` numerals `#8f7fb4` on `--bg-elev` | 4.97:1 |

The numerals were drawn at `#6c5b8c` first, which `number-details` would have liked (2.98:1,
architectural) and which fails AA at 12 px. They were raised until they passed; the "architectural"
quality now comes from their size, their mono face and their position in the gutter, not from
being too faint to read.

---

## 2. Type

Three faces, and the display face is the only download.

| Role | Face | Spec |
|---|---|---|
| h1, gesture names, the triptych labels, the HUD labels, the emote name | **Fredoka 700** | Self-hosted, `/fonts/fredoka-700-latin.woff2`, 15.9 KB, latin subset, SIL OFL 1.1 (`public/fonts/OFL.txt`), `font-display: swap`, preloaded. Weight 700 only. |
| Everything else in prose | system stack | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Eyebrow, timings, percentages, `01/02/03`, the demo caption | system mono | `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace` |

The mono is a system stack on purpose: the page already downloads about 40 MB of MediaPipe models,
so one 15.9 KB display face is the whole type budget.

Scale: h1 `clamp(30px, 6vw, 44px)/1.05`, tracking `-0.01em`. Gesture names 17/1.2. Lede 17/1.55.
Body 16/1.55. Hints, notes and panel prose 14. Mono 11–13, `tabular-nums` wherever a number moves.
Eyebrow 11 uppercase, tracking `0.14em`.

---

## 3. Shape and material

**One chamfer family** (`corner-diagonals`). Every surface is cut at the top-left and the
bottom-right with the same polygon, applied to background, border and hit area together:

```css
clip-path: polygon(
  var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)),
  calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut)
);
```

`--cut-sm: 8px` on controls · `--cut-md: 14px` on gesture rows and how-it-works panels ·
`--cut-lg: 22px` on the arena. Nothing on the page is a rounded pill or a 16 px card.

**The arena** (`funky-purple-container-tech`) is the framed shell the whole page hangs off: a 1 px
gold-tinted gradient edge, one contact shadow, four corner brackets, a floor rule across the lower
third and a radial floor-light coming up from beneath it. That light is the only glow on the page
and it is concentrated there; the purple is never washed. When a session starts the frame's edge
brightens and the furniture steps back behind the picture.

**Two rounded surfaces, and only two**: the plate at 20 px and the beam ring at 10 px. That is
the hierarchy `corner-diagonals` asks for when rounded and chamfered geometry share a page —
everything that is *interface* is chamfered; the *physical object* thrown into the arena is
molded, and the halo that traces a mark follows the mark's own soft shape rather than the
interface's. A third rounded surface means the distinction has been lost.

**One skeuomorphic object** (`skeuomorphic-ui`): the plate the emote lands on. Soft vertical
gradient, a 1 px reflective gradient border, stacked outer elevation plus inset carved depth, a
top-edge highlight and a darker lower edge. Nothing else on the page is skeuomorphic — mixing
materials is the skill's own first rule.

**Elevation** (`beautiful-shadows`, tinted to the purple ground rather than pure black, which is
that skill's rule via `skeuomorphic-ui`): `--shadow-sm` is the skill's three-layer "Beautiful sm"
shape — a soft drop, a hairline under-edge and a 1 px ring — on controls. The arena carries a
single tinted contact shadow through `filter: drop-shadow()`, because a `clip-path`ed surface
clips `box-shadow` and `drop-shadow()` takes one shadow; chaining several full-element blurs
behind a live video is not worth the paint. One strength per component state.

---

## 4. Imagery

**Three authored interface marks**, drawn for this app, in one stroke system: 3 px
`vector-effect: non-scaling-stroke`, round caps and joins, `currentColor`, 32-unit viewBox. A
thumb, a flexed arm and a yawning face. They live as `<symbol>`s at the top of `index.html` and are
used by `<use>` in the resting triptych, the HUD strip, the gesture rows and the favicon. They are
the app's vocabulary.

**Supercell's emote art and sounds are the payload, never the chrome.** `public/emotes/*` is
byte-identical to what shipped before, is used only inside `#emote-img` when a gesture fires, and
is credited verbatim in the footer under the Fan Content Policy. It is not in the favicon, not in
the OG image, and not in any list, tile or label.

**The landmark overlay** is drawn in `--muted` at 0.5–0.7 alpha, so the machinery reads as
machinery behind the cartoon instead of competing with the payload for attention.

---

## 5. Motion

One easing family, plus one deliberate landing curve driving exactly one beat.

```css
--ease:      cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-exit: cubic-bezier(0.4, 0.0, 1, 1);
--ease-land: cubic-bezier(0.2, 1.25, 0.35, 1);   /* the emote landing, and nothing else */
```

That beat takes two keyframes, because the emote and the plate it lands on are separate
elements: `land` on `.emote.pop` and `plate` on `.emote.pop .emote-plate`, same duration, same
curve, same moment. They are the only two animations in the file that use `--ease-land`, and a
third would mean the page has grown a second bouncy moment.

Durations: micro 140 ms · state 200 ms · pop 340 ms · exit 180 ms · section 520 ms · hero 700 ms ·
stagger 60 ms (35 ms for hero words).

| # | What moves | Why | Under `prefers-reduced-motion: reduce` |
|---|---|---|---|
| M1 | h1 words rise through a mask, on load | hierarchy | Never split. Plain h1, no motion. |
| M2 | Gesture rows, how-it-works panels and the timings list rise once on scroll | attention | Complete on first paint. |
| M3 | Arena edge brightens, HUD strip rises out of the bottom edge | feedback + continuity | No slide and no colour transition: at rest the strip is out of the arena, once running it is in, each state complete on its own. |
| M4 | HUD marks fill with gold from the live score | it is the data | Still updates; snaps instead of tracking. |
| M5 | A travelling gold edge beam on one HUD mark while `0.35 < score < 0.5` (3.2 s, linear, opacity 0.6, no fade-in) | attention | A complete static gold border. |
| M6 | The emote lands on its plate | feedback | Full scale, 120 ms opacity fade, no overshoot, plate static. |
| M7 | The emote leaves | continuity | 120 ms fade. |
| M8 | Button press and hover | feedback | Colour only, no translate. |

**No perpetual loop runs behind content.** M5 is the only looping animation on the page, and it is
gated on a real measured score, drawn in front of nothing, one at a time. At rest the page is still.

What animates: `transform` and `opacity` everywhere that moves; `clip-path` on the three HUD
marks (40 px, 28 px below 560 px); the colour properties `background`, `border-color` and `color`
on the buttons, the arena edge and the HUD marks; and the registered custom property
`--beam-angle` on the one gated beam. **No layout property animates** — the skip link moves on
`transform`, not `top`. No animated blur, no animated shadow, no per-frame layout measurement, no
smooth-scroll engine, no WebGL, no particle system.

M5 is the one thing here that is not free: while a score sits in the almost band it repaints a
masked conic gradient at frame rate over the live video, next to three MediaPipe models. One
small element, one at a time, gated on a real measurement, gone the moment the gesture fires.

---

## 6. Layout

Single column, `max-width: 880px`, gutter 20 px below 720 px and 40 px above it.

Order at **both** widths: skip link → masthead → controls → arena → the three gestures → how it
works → footer. Putting the controls before the arena is what keeps "Start camera" above the fold
at 1440; the arena is additionally capped at `min(60vh, 520px)`, so no viewport has to scroll to
find the primary action.

At ≤ 560 px the HUD marks drop to 28 px and lose their labels, the buttons tighten so Mute stays on
the control row, and the timings list folds from two columns to one.

---

## 7. Accessibility

- One skip link, to the camera.
- `:focus-visible` on every control. Because `clip-path` clips an outline, chamfered controls draw
  a cyan ring *inside* themselves with `outline-offset: -4px`; unclipped elements keep the ordinary
  outside ring.
- `aria-live="polite"` on the status line and the hints; `aria-live="assertive"` on the emote.
- The overlay canvas and the HUD strip are `aria-hidden`: every value the HUD draws is already
  announced by the hints and the status line, and a live score would otherwise be read at frame rate.
- The split h1 keeps its full accessible name through `aria-label`; the word spans are `aria-hidden`.
- `aria-pressed` on Mute. 44 px minimum on every button.
- A `[data-reveal]` block's resting state IS its final state. `reveal.ts` adds `reveal-ready` to
  `<html>` only when it is really about to animate, so no section can be left invisible by a
  script that did not run, an observer that never fired, or a browser without
  `IntersectionObserver`.

---

## 8. Extending this

- **A new state gets a colour only if gold or cyan already means the wrong thing.** If you find
  yourself reaching for a third hue, the state probably wants a rule, a weight or a position instead.
- **A new surface uses the existing chamfer family**, at the size that matches its scale. Do not
  introduce a radius.
- **A new animation needs a row in § 5**: what moves, which of the five reasons it serves, and what
  it lands on under `reduce`. If it has no reason, delete it (`animation-systems`).
- **A second skeuomorphic object is a regression.** The plate is the one physical thing here.
- **Never put Supercell's art, colours, type or set dressing in the chrome.** Their emote is
  content that this page displays and credits; it is not this page's brand.
