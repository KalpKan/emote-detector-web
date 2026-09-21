# emotes — redesign status ("Your own arena")

Night protocol acknowledged 2026-09-21 ~06:25 UTC.

Task: redesign https://emotes.kalpkan.com to its PRIMARY direction, "Your own arena"
(`portfolio/docs/design/app-directions.md` § 6), MengTo-skill-guided, on branch `redesign`.

## Definition of done

Each item is verifiable by a command, a URL check or a screenshot. Evidence goes in the
"Evidence" column as it lands.

| # | Done criterion | How it is verified | Status | Evidence |
|---|---|---|---|---|
| 1 | `docs/design/spec.md` locked before any code, filled from `design-first-ui-prompting`, listing every MengTo skill used and where | file exists, committed before the first code commit | TODO | — |
| 2 | `docs/design/plan.md` written from the spec via `superpowers:writing-plans` | file exists | TODO | — |
| 3 | Original purple-and-gold cartoon arena (SVG/CSS, no Supercell chrome) renders at 1440 and 390 | claude-in-chrome screenshots at both widths | TODO | — |
| 4 | Camera-on states verified through a fake camera at 1440 and 390 | `node scripts/e2e-camera.mjs` (puppeteer-core, `--use-fake-device-for-media-stream`) + `scripts/e2e-arena.mjs` | TODO | — |
| 5 | Gesture logic untouched; the attributed Supercell art/sounds untouched | `git diff main -- src/gestures src/emotes.ts src/demo.ts src/hints.ts public/emotes` is empty | TODO | — |
| 6 | Tests green | `npm run typecheck`, `npm test` | TODO | — |
| 7 | Motion audited against `animation-systems`; every animation has a reason; one easing family; no perpetual loop behind content | `docs/design/spec.md` § Motion inventory + reviewer verdict | TODO | — |
| 8 | `prefers-reduced-motion: reduce` lands on a complete static final state for every animation | `scripts/e2e-arena.mjs --reduced` asserts final states | TODO | — |
| 9 | Build green | `npm run build` | TODO | — |
| 10 | ≤ 2 Vercel deploys (1 preview + 1 production) | `npx vercel ls emotes` | TODO | — |
| 11 | Lighthouse ≥ 0.85 (webcam app) | headless Lighthouse on the production URL | TODO | — |
| 12 | Live on https://emotes.kalpkan.com with the redesign | `curl` + browser check | TODO | — |
| 13 | Reviewer APPROVE (design fidelity + audit-ai-design-slop + motion + /code-review) | `reviewer` sub-agent verdict | TODO | — |
| 14 | Verifier PASS (fresh context, reproduces from scratch on the live URL) | `verifier` sub-agent verdict | TODO | — |
| 15 | `docs/design/DESIGN.md` + README design section | files exist | TODO | — |
| 16 | One line added to `~/projects/portfolio/STATUS.md` session log | file diff | TODO | — |

## Decisions taken without Kalp (per the night protocol)

- **Playwright vs puppeteer-core.** The brief said "Playwright + fake camera". Kept puppeteer-core
  because the fake-camera harness already exists, is the committed detection gate, and a second
  browser-automation dependency re-validates nothing. Overnight-supervisor ruling 2026-09-21
  (Option A). Reversible later; the assertions run against the page's own DOM ids either way.
- **`beam-glow-states` in hand-written CSS.** The skill ships a React `border-beam` package; this app
  is vanilla TS. Implemented the skill's behaviour instead (one beam per viewport, gated on a real
  measured score in 0.35–0.5, static gold border under reduced motion). Supervisor concurred.
- **Mono face is the system mono stack**, not a second webfont. The page already downloads ~40 MB of
  models; one 15.9 KB display webfont is the whole type budget.

## Needs Kalp

- Nothing blocking. Two optional follow-ups:
  - An OG/social share image. One is now generated at `public/og.png` from `scripts/make-og.mjs`
    (headless Chrome, no new dependency). If you dislike it, replace the PNG; the meta tags stay.
  - The original Python repo `KalpKan/clash-emote-bot-python` is untouched by this work.

## Gate output

See `docs/design/plan.md` § Verification log for the raw command output captured on the night of
2026-09-21.
