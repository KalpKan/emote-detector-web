/**
 * The app's own vocabulary: one authored interface mark per gesture, drawn in a single
 * stroke system (3 px non-scaling stroke, round caps and joins, `currentColor`) as
 * <symbol>s in index.html and referenced with <use>.
 *
 * These are the chrome. Supercell's emote art is the payload that pops in the arena when
 * a gesture fires, and it is never the interface's own vocabulary again.
 */
import type { Gesture } from "./gestures/engine";

export const MARK_ID: Record<Gesture, string> = {
  thumbs_up: "mark-thumbs_up",
  flex: "mark-flex",
  yawn: "mark-yawn",
};

/** Same-document reference for an `<svg><use href="…">`. */
export function markHref(gesture: Gesture): string {
  return `#${MARK_ID[gesture]}`;
}
