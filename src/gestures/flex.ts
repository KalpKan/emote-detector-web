/**
 * Flex ("Goblin Muscle") rule.
 *
 * Rewritten in FIX round 1 (docs/reports/emotes.md D2): the Python port scored
 * elbow angle + wrist height + wrist-near-head, which any hand on the face
 * satisfies (cover-eyes, a dab, a thumb beside the cheek). A flex is now five
 * cues, every one measured in shoulder widths so it is distance-independent,
 * and the score is the WEAKEST cue, so a missing cue cannot be compensated by
 * the others:
 *
 *   bend    elbow angle in the 35-80 degree band (a curled bicep)
 *   height  wrist well above the shoulder
 *   beside  wrist OUTSIDE the shoulder line (beside the head, not in front of the face)
 *   level   elbow raised to about shoulder height (not hanging, not overhead)
 *   clear   wrist away from the face (not touching the nose / eyes / face box)
 *
 * "Outside" is measured away from the other shoulder, so it works whichever way
 * the person faces and whether or not the video is mirrored.
 */
import type { FaceMetrics } from "./face";
import { angle, dist, insideBox, normalise, scaled, type Pt } from "./geometry";

/** MediaPipe pose landmark indices (33-point model). */
export const POSE = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const;

export type FlexCues = { bend: number; height: number; beside: number; level: number; clear: number };
export type FlexScore = { score: number; cues: FlexCues; arm: "left" | "right" | null };
export type FlexContext = { aspect?: number; face?: FaceMetrics | null };

const ZERO: FlexCues = { bend: 0, height: 0, beside: 0, level: 0, clear: 0 };

function scoreArm(P: readonly Pt[], side: "left" | "right", ctx: FlexContext): FlexScore {
  const [si, ei, wi, oi] =
    side === "left"
      ? [POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST, POSE.RIGHT_SHOULDER]
      : [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST, POSE.LEFT_SHOULDER];
  const shoulder = P[si];
  const elbow = P[ei];
  const wrist = P[wi];
  const other = P[oi];
  const none: FlexScore = { score: 0, cues: { ...ZERO }, arm: side };
  if (!shoulder || !elbow || !wrist || !other) return none;
  const shW = dist(shoulder, other);
  if (shW < 1e-3) return none;

  const elbowAngle = angle(shoulder, elbow, wrist);
  if (elbowAngle === null) return none;
  // Full marks between 35 and 80 degrees, fading out by 20 and 110.
  const bend = Math.min(normalise(elbowAngle, 20, 35), 1 - normalise(elbowAngle, 80, 110));

  // Wrist above the shoulder by 0.2..0.4 shoulder widths (y grows downwards).
  const height = normalise((shoulder.y - wrist.y) / shW, 0.2, 0.4);

  // Wrist outside the shoulder line: away from the other shoulder by 0.08..0.25 shoulder widths.
  const outward = Math.sign(shoulder.x - other.x) || 1;
  const beside = normalise(((wrist.x - shoulder.x) * outward) / shW, 0.08, 0.25);

  // Elbow at about shoulder height: between 0.45 below and 0.35 above, fading at the edges.
  const elbowUp = (shoulder.y - elbow.y) / shW;
  const level = Math.min(normalise(elbowUp, -0.5, -0.35), 1 - normalise(elbowUp, 0.25, 0.4));

  // Wrist clear of the face: at least 0.35..0.5 shoulder widths from the nose and outside the face box.
  const head = [P[POSE.NOSE], P[POSE.LEFT_EYE], P[POSE.RIGHT_EYE]].filter((p): p is Pt => p !== undefined);
  let clear = head.length ? normalise(Math.min(...head.map((h) => dist(wrist, h))) / shW, 0.35, 0.5) : 1;
  if (ctx.face) {
    const a = ctx.aspect ?? 1;
    const box = { x0: ctx.face.box.x0 * a, x1: ctx.face.box.x1 * a, y0: ctx.face.box.y0, y1: ctx.face.box.y1 };
    if (insideBox(wrist, box, 0.1)) clear = 0;
  }

  const cues = { bend, height, beside, level, clear };
  return { score: Math.min(bend, height, beside, level, clear), cues, arm: side };
}

/** Flex score for the better arm with the cue breakdown; 0 when the pose is missing. */
export function scoreFlexDetailed(pose: readonly Pt[] | null | undefined, ctx: FlexContext = {}): FlexScore {
  if (!pose || pose.length < 17) return { score: 0, cues: { ...ZERO }, arm: null };
  const P = scaled(pose, ctx.aspect ?? 1);
  const left = scoreArm(P, "left", ctx);
  const right = scoreArm(P, "right", ctx);
  if (left.score === right.score) {
    // Tie (usually both 0): report the arm that is closer, by the sum of its cues.
    const sum = (c: FlexCues) => c.bend + c.height + c.beside + c.level + c.clear;
    return sum(left.cues) >= sum(right.cues) ? left : right;
  }
  return left.score > right.score ? left : right;
}

/** Best flex score over both arms, 0 when the pose is missing. */
export function scoreFlex(pose: readonly Pt[] | null | undefined, ctx: FlexContext = {}): number {
  return scoreFlexDetailed(pose, ctx).score;
}
