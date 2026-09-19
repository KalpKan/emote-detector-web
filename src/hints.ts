/**
 * Plain-English coaching for the page (S7): one line per cue that a rule can
 * report as the weakest part of a nearly-there gesture, plus the stage sizing
 * helper for the camera stream (D6). Pure functions, so the unit tests cover the
 * copy without a browser.
 */
import type { Gesture } from "./gestures/engine";

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
