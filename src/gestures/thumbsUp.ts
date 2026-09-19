/**
 * Thumbs-up rule.
 *
 * Rewritten in FIX round 1 (docs/reports/emotes.md D1). The Python port's
 * "fingers folded" cue wanted every fingertip 0.02-0.14 of the FRAME below its
 * PIP joint; in a real fist the tips sit level with the knuckles, so the strict
 * rule scored 0 on every real photo and only the loose rule ever fired. Every
 * cue is now measured relative to the hand's own size (wrist to middle knuckle),
 * so it is independent of distance from the camera and of the frame's aspect:
 *
 *   folded   the four fingers curl: the angle at each PIP joint (knuckle-PIP-tip)
 *            is small, or the tip is closer to the wrist than the PIP is
 *   up       thumb tip well above the wrist
 *   upright  thumb points up (within ~35 degrees of vertical)
 *   clear    thumb tip above the folded fingertips and the hand not over the face
 *
 * The score is the weakest cue, so an open palm (folded = 0), a fist with the
 * thumb tucked (up = 0) or a hand over the mouth (clear = 0) all score nothing.
 */
import type { FaceMetrics } from "./face";
import { angle, dist, insideBox, normalise, scaled, type Pt } from "./geometry";

/** MediaPipe hand landmark indices (21-point model). */
export const HAND = {
  WRIST: 0,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
} as const;

export type ThumbCues = { folded: number; up: number; upright: number; clear: number };
export type ThumbScore = { score: number; cues: ThumbCues };
export type ThumbContext = { aspect?: number; face?: FaceMetrics | null };

const ZERO: ThumbCues = { folded: 0, up: 0, upright: 0, clear: 0 };
const FINGERS: Array<[number, number, number]> = [
  [HAND.INDEX_MCP, HAND.INDEX_PIP, HAND.INDEX_TIP],
  [HAND.MIDDLE_MCP, HAND.MIDDLE_PIP, HAND.MIDDLE_TIP],
  [HAND.RING_MCP, HAND.RING_PIP, HAND.RING_TIP],
  [HAND.PINKY_MCP, HAND.PINKY_PIP, HAND.PINKY_TIP],
];

function scoreOneHand(hand: readonly Pt[], ctx: ThumbContext): ThumbScore {
  const none: ThumbScore = { score: 0, cues: { ...ZERO } };
  if (hand.length < 21) return none;
  const H = scaled(hand, ctx.aspect ?? 1);
  const wrist = H[HAND.WRIST];
  const size = dist(wrist, H[HAND.MIDDLE_MCP]);
  if (size < 1e-3) return none;

  // Curl per finger: angle at the PIP under 70 degrees is folded, over 120 is straight;
  // or the tip has come back to the wrist (tip closer than the PIP by a margin).
  let folded = 1;
  for (const [mcp, pip, tip] of FINGERS) {
    const a = angle(H[mcp], H[pip], H[tip]);
    const byAngle = a === null ? 0 : 1 - normalise(a, 70, 120);
    const byReach = 1 - normalise(dist(wrist, H[tip]) / Math.max(dist(wrist, H[pip]), 1e-5), 0.85, 1.15);
    folded = Math.min(folded, Math.max(byAngle, byReach));
  }

  const thumbTip = H[HAND.THUMB_TIP];
  const up = normalise((wrist.y - thumbTip.y) / size, 0.6, 1.1);

  const thumbMcp = H[HAND.THUMB_MCP];
  const dir = (Math.atan2(-(thumbTip.y - thumbMcp.y), thumbTip.x - thumbMcp.x) * 180) / Math.PI; // 90 = straight up
  const upright = 1 - normalise(Math.abs(dir - 90), 35, 60);

  const highestTip = Math.min(...FINGERS.map(([, , tip]) => H[tip].y));
  let clear = normalise((highestTip - thumbTip.y) / size, 0.2, 0.5);
  if (ctx.face) {
    const a = ctx.aspect ?? 1;
    const box = { x0: ctx.face.box.x0 * a, x1: ctx.face.box.x1 * a, y0: ctx.face.box.y0, y1: ctx.face.box.y1 };
    if (insideBox(H[HAND.MIDDLE_MCP], box) || insideBox(wrist, box)) clear = 0;
  }

  const cues = { folded, up, upright, clear };
  return { score: Math.min(folded, up, upright, clear), cues };
}

/** Thumbs-up score for the best hand with its cue breakdown; 0 without hands. */
export function scoreThumbsUpDetailed(hands: readonly (readonly Pt[])[] | null | undefined, ctx: ThumbContext = {}): ThumbScore {
  let best: ThumbScore = { score: 0, cues: { ...ZERO } };
  let bestSum = -1;
  for (const hand of hands ?? []) {
    const r = scoreOneHand(hand, ctx);
    const sum = r.cues.folded + r.cues.up + r.cues.upright + r.cues.clear;
    if (r.score > best.score || (r.score === best.score && sum > bestSum)) {
      best = r;
      bestSum = sum;
    }
  }
  return best;
}

export function scoreThumbsUp(hands: readonly (readonly Pt[])[] | null | undefined, ctx: ThumbContext = {}): number {
  return scoreThumbsUpDetailed(hands, ctx).score;
}
