/**
 * The arena's scoreboard. Each of the three marks along the bottom edge of the stage fills
 * with gold as its gesture's score rises, so the meters ARE the arena's furniture rather than
 * three identical cards below it.
 *
 * This module owns DOM only. Every number it draws is computed by the gesture engine, which
 * this redesign does not touch.
 */
import { GESTURES, type Gesture } from "./gestures/engine";

/** The "almost there" band, from docs/design/spec.md § 2 (M5). */
export const BEAM_LOW = 0.35;
export const BEAM_HIGH = 0.5;

/**
 * Which single mark carries the edge beam this frame, if any.
 *
 * `beam-glow-states` allows one dominant beam per viewport, so this returns the leading
 * candidate and never a set. A gesture that is already active is excluded: the emote is the
 * feedback then, and a beam under a firing gesture would say "almost" about something that has
 * already happened.
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
