# emotes — redesign status ("Your own arena")

Night protocol acknowledged 2026-09-21 ~06:25 UTC.

Task: redesign https://emotes.kalpkan.com to its PRIMARY direction, "Your own arena"
(`portfolio/docs/design/app-directions.md` § 6), MengTo-skill-guided, on branch `redesign`,
merged to `main` as `f59f7f4`.

## Definition of done

| # | Done criterion | How it is verified | Status | Evidence |
|---|---|---|---|---|
| 1 | `docs/design/spec.md` locked before any code, filled from `design-first-ui-prompting`, listing every MengTo skill used and where | file exists, committed before the first code commit | DONE | `docs/design/spec.md` in commit `e1a773f`, which precedes every code commit |
| 2 | `docs/design/plan.md` written from the spec via `superpowers:writing-plans` | file exists | DONE | `docs/design/plan.md`, same commit, with the Verification log |
| 3 | Original purple-and-gold cartoon arena (SVG/CSS, no Supercell chrome) renders at 1440 and 390 | screenshots at both widths | DONE | `docs/images/redesign/` — `1440-rest`, `1440-running`, `1440-reduced-motion`, `1440-full`, `390-rest`, `390-running`, `390-full`. Plus the live page in Kalp's own Chrome at 1440. |
| 4 | Camera-on states verified through a fake camera at 1440 and 390 | `node scripts/e2e-arena.mjs` (puppeteer-core, `--use-fake-device-for-media-stream`) | DONE | 18 camera assertions PASS at both widths: reaches "Watching", Stop appears, percentages appear, HUD up, a mark fills from a live score, an emote fires and lands on its plate, the payload is still Supercell's own art, console clean. Raw output in `docs/design/plan.md` § Verification log. |
| 5 | Gesture logic untouched; the attributed Supercell art/sounds untouched | `git diff d80120d main -- …` is empty | DONE | Empty for `src/gestures`, `src/emotes.ts`, `src/hints.ts`, `src/demo.ts`, `src/fixtures.ts`, `src/landmarkers.ts`, `src/analytics.ts`, `public/emotes`, `public/mediapipe`, `public/demo`, `public/health.json` and all seven corpus test files. `src/draw.ts` differs only in six colour literals and a comment. |
| 6 | Tests green | `npm run typecheck`, `npm test` | DONE | typecheck clean; **197 passed / 9 files** (the 114-item detection corpus among them, unchanged) |
| 7 | Motion audited against `animation-systems`; every animation has a reason; one easing family; no perpetual loop behind content | spec § 2 + reviewer verdict | DONE | One family `--ease`, one documented overshoot used by one keyframe pair, one exit curve. Durations inside the skill's bands. M5 is the only loop and it is gated on a real score, one mark at a time, in front of nothing. |
| 8 | `prefers-reduced-motion: reduce` lands on a complete static final state for every animation | the design gate asserts it | DONE | 8 reduce assertions PASS, including the two that were previously vacuous: the beam does not travel (with `.is-almost` actually applied) and the HUD strip is **out** of the arena at rest, `translateY=80.8` |
| 9 | Build green | `npm run build` | DONE | clean; `index.css` 13.9 kB (4.1 kB gz), `index.js` 28.4 kB (11.2 kB gz) |
| 10 | ≤ 2 Vercel deploys (1 preview + 1 production) | deploy log | DONE | 1 preview (`emotes-qat63yt3w`, CLI) + 1 production (Git integration on the `main` push). No others. |
| 11 | Lighthouse ≥ 0.85 (webcam app) | headless Lighthouse on production | DONE | **performance 0.99 · accessibility 1.00 · best-practices 1.00 · seo 1.00** |
| 12 | Live on https://emotes.kalpkan.com with the redesign | curl + browser | DONE | `HTTP/2 200`; the three `mark-*` symbols present; **0** `src="/emotes/` in the chrome; `/health.json` → `{"ok":true,"service":"emotes"}`; `/og.png` and `/fonts/fredoka-700-latin.woff2` both 200. Design gate re-run **against the live URL: 67/67**. |
| 13 | Reviewer APPROVE | `reviewer` sub-agent | DONE (after fixes) | Verdict was **REJECT** with 3 blocking items — all three were real and all three are fixed in `a075fcd`. See below. |
| 14 | Verifier PASS | `verifier` sub-agent, fresh context, live URL | see the final report |
| 15 | `docs/design/DESIGN.md` + README design section | files exist | DONE | `docs/design/DESIGN.md`; `README.md` § Design |
| 16 | One line added to `~/projects/portfolio/STATUS.md` session log | file diff | DONE | added via a throwaway worktree at wind-down |

## What the reviewer caught, and why it mattered

The reviewer returned REJECT, correctly. All three blocking items were fixed in `a075fcd`
before the merge, so no extra deploy was needed.

1. **The reduced-motion path landed on the wrong state.** `@media (prefers-reduced-motion: reduce)`
   forced `.hud { transform: translateY(0) }` unconditionally, so a reduced-motion visitor saw the
   scoreboard's three marks 80 px below the triptych's three marks *at rest* — six marks, three
   names printed twice, the arena's floor rule covered. That is the running state shown at rest,
   not a complete final state, and it re-introduced the exact P3 audit item the spec claims to
   close, on the accessibility path specifically.
2. **Five claims in the design docs were false of the shipped code** — the "only transform,
   opacity, clip-path and border-color animate" sentence (five counter-examples, including the
   skip link animating `top`), the mark size, a "rim flash" that was never built, the beam's
   opacity and timing function, and the "one rounded thing on the page" rule. All corrected, and
   the skip link now moves on `transform` so the sentence is true rather than aspirational.
3. **A gate assertion that could not fail.** The reduced-motion beam check read `::after` on a
   `.hud-cell` that was not `.is-almost`, so it returned `"none"` whatever the media query said —
   it would have passed with the override deleted. That is also why item 1 shipped. It now applies
   the class first and additionally asserts the resting HUD position.

Five non-blocking items were also taken: the how-it-works panels use multicol so the columns
balance instead of leaving a 152 px hole, the dead fourth grid track is gone from the resting
gesture rows, the gesture list uses the throwing `$()` lookup, the skip link is cyan because it
is a link, and the flex mark was redrawn with a longer upper arm and a stronger bicep dome.

## Decisions taken without Kalp (per the night protocol)

- **Playwright vs puppeteer-core.** The brief said "Playwright + fake camera". Kept puppeteer-core
  because the fake-camera harness already exists, is the committed detection gate, and a second
  browser-automation dependency re-validates nothing. Overnight-supervisor ruling 2026-09-21
  ~06:30 UTC (Option A). Reversible later; the assertions run against the page's own DOM ids
  either way.
- **`beam-glow-states` in hand-written CSS.** The skill ships a React `border-beam` package; this
  app is vanilla TS. Implemented the skill's behaviour instead (one beam per viewport, gated on a
  real measured score in 0.35–0.5, static gold border under reduced motion). Supervisor concurred.
- **The mono face is the system mono stack**, not a second webfont. The page already downloads
  ~40 MB of models; one 15.9 KB display webfont (Fredoka 700, SIL OFL 1.1) is the whole type budget.
- **`claude-in-chrome` could not be driven below the OS minimum window width**, so the 390 evidence
  is the headless captures in `docs/images/redesign/` and the 390 assertions in the design gate,
  both of which were run against the live URL. The 1440 check in Kalp's own Chrome passed and its
  console was clean (the only errors came from his MetaMask extension, not the page).

## Needs Kalp

Nothing blocking. Three optional follow-ups, in the order I would do them:

1. **Look at the flex mark ("Goblin Muscle") and say whether it reads as a flexed arm to you.**
   It was redrawn once after review and is better, but it is the least legible of the three
   authored marks at 28 px, and it is used in the HUD, the gesture rows and the OG image.
   It lives in `index.html` as `<symbol id="mark-flex">` and is duplicated in `scripts/make-og.mjs`.
2. **`public/og.png`** is generated by `node scripts/make-og.mjs` (headless Chrome, no new
   dependency). Replace the PNG if you dislike it; the meta tags stay.
3. **A Playwright port of the fake-camera harness**, if you would rather have one. Nothing in the
   current setup blocks it.
