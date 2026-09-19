/**
 * Plain-English coaching for the page (S7): one line per cue that a rule can
 * report as the weakest part of a nearly-there gesture, plus the stage sizing
 * helper for the camera stream (D6). Pure functions, so the unit tests cover the
 * copy without a browser.
 */
import type { Gesture, Hint } from "./gestures/engine";

const HINTS: Record<Gesture, Record<string, string>> = {
  flex: {
    bend: "Bend the elbow more, so the forearm folds up towards the shoulder.",
    height: "Raise the fist higher, well above the shoulder.",
    beside: "Bring the fist out beside your head, not in front of your face.",
    level: "Lift the elbow out to shoulder height.",
    clear: "Keep the fist away from your face.",
  },
  thumbs_up: {
    folded: "Fold the other four fingers into a fist.",
    up: "Point the thumb straight up, well above the wrist.",
    upright: "Straighten the thumb so it points up, not sideways.",
    clear: "Hold the thumb higher than the fist, away from your face.",
  },
  yawn: {
    mouth: "Open wider, a real jaw-dropping yawn.",
    eyes: "Let your eyes close as you yawn.",
    brows: "Relax your brows; a frown reads as a scream.",
  },
};

const FALLBACK: Record<Gesture, string> = {
  flex: "Flex: bend one arm and bring your fist up beside your head.",
  thumbs_up: "Thumbs up: fingers folded, thumb straight up, in front of the camera.",
  yawn: "Yawn: open wide and let your eyes close.",
};

/** What to change for `gesture` when `cue` is the weakest part of it. */
export function hintText(gesture: Gesture, cue: string): string {
  return HINTS[gesture][cue] ?? FALLBACK[gesture];
}

/** CSS aspect-ratio for the stage: the stream's own shape, or 4:3 before there is one. */
export function stageAspect(videoWidth: number, videoHeight: number): string {
  if (videoWidth > 0 && videoHeight > 0) return `${videoWidth} / ${videoHeight}`;
  return "4 / 3";
}

/** How long a shown hint stays before a different one may replace it. */
export const HINT_HOLD_MS = 900;

export type ShownHint = { gesture: Gesture; cue: string };

/**
 * Decides which hint the page shows (S7). FIX round 2 (D3): the round-1 page only held a hint
 * against a new hint for the SAME gesture, so when two gestures were close the line flickered
 * between "Almost a Goblin Muscle" and "Almost a Thumbs Up" at frame rate. Now whatever is shown
 * stays for HINT_HOLD_MS, whichever gesture the next candidate belongs to, and only a gesture
 * becoming active clears it at once (the emote is the feedback then).
 */
export class HintHold {
  private shown: ShownHint | null = null;
  private until = 0;

  /** @returns the hint to show after this frame (null = the idle text). */
  update(candidate: Hint | null, active: Gesture | null, now: number): ShownHint | null {
    if (active !== null) {
      this.shown = null;
      this.until = 0;
      return null;
    }
    if (this.shown !== null && now < this.until) return this.shown;
    const next = candidate ? { gesture: candidate.gesture, cue: candidate.cue } : null;
    const same = next === null ? this.shown === null : this.shown !== null && this.shown.gesture === next.gesture && this.shown.cue === next.cue;
    if (!same) {
      this.shown = next;
      this.until = next ? now + HINT_HOLD_MS : 0;
    }
    return this.shown;
  }

  reset(): void {
    this.shown = null;
    this.until = 0;
  }
}
