/**
 * Thumbs-up rules, ported from the Python app.
 *
 * `scoreThumbStrict` is `PoseGestureRecognizer._score_thumb_direction(direction="up")`:
 * thumb tip well above the wrist, roughly on the wrist's vertical, thumb pointing
 * up, and all four fingers folded (tips below their PIP joints). Every cue must be
 * confident (>= 0.65, folded >= 0.6) or the hand scores 0.
 *
 * `scoreThumbLoose` is `BehaviorAnalyzer._score_thumbs_up`: the cheaper hand-only
 * check (thumb above wrist and index knuckle, more vertical than horizontal).
 * The engine keeps the loose score only when it is >= 0.6, as the Python app did.
 */
import { clamp, normalise, type Pt } from "./geometry";

/** MediaPipe hand landmark indices (21-point model). */
export const HAND = {
  WRIST: 0,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
} as const;

function scoreOneHandStrict(hand: readonly Pt[]): number {
  if (hand.length < 21) return 0;
  const wrist = hand[HAND.WRIST];
  const thumbTip = hand[HAND.THUMB_TIP];
  const thumbIp = hand[HAND.THUMB_IP];

  const verticalDelta = wrist.y - thumbTip.y;
  const verticalScore = normalise(verticalDelta, 0.09, 0.25);

  const thumbAlignment = verticalDelta - Math.abs(thumbTip.x - wrist.x);
  const alignmentScore = normalise(thumbAlignment, 0.02, 0.25);

  const folds: Array<[number, number]> = [
    [HAND.INDEX_TIP, HAND.INDEX_PIP],
    [HAND.MIDDLE_TIP, HAND.MIDDLE_PIP],
    [HAND.RING_TIP, HAND.RING_PIP],
    [HAND.PINKY_TIP, HAND.PINKY_PIP],
  ];
  const foldedScore = Math.min(...folds.map(([tip, pip]) => normalise(hand[tip].y - hand[pip].y, 0.02, 0.14)));

  const thumbDirection = Math.atan2(thumbTip.y - thumbIp.y, thumbTip.x - thumbIp.x);
  const orientationOffset = Math.abs(thumbDirection + Math.PI / 2);
  const orientationScore = normalise(Math.PI / 2 - orientationOffset, 0.25, Math.PI / 2);

  const components = Math.min(verticalScore, alignmentScore, orientationScore);
  if (components < 0.65 || foldedScore < 0.6) return 0;
  return clamp(Math.min(components, foldedScore), 0, 1);
}

function scoreOneHandLoose(hand: readonly Pt[]): number {
  if (hand.length < 21) return 0;
  const wrist = hand[HAND.WRIST];
  const thumbTip = hand[HAND.THUMB_TIP];
  const indexMcp = hand[HAND.INDEX_MCP];
  const dy = thumbTip.y - wrist.y;
  const dx = thumbTip.x - wrist.x;
  const verticality = Math.abs(dy) - Math.abs(dx);
  if (thumbTip.y < wrist.y - 0.05 && thumbTip.y < indexMcp.y - 0.03 && verticality > 0.05) {
    return Math.min(1, (verticality - 0.05) * 6 + 0.5);
  }
  return 0;
}

export function scoreThumbStrict(hands: readonly (readonly Pt[])[] | null | undefined): number {
  if (!hands || hands.length === 0) return 0;
  return Math.max(0, ...hands.map(scoreOneHandStrict));
}

export function scoreThumbLoose(hands: readonly (readonly Pt[])[] | null | undefined): number {
  if (!hands || hands.length === 0) return 0;
  return Math.max(0, ...hands.map(scoreOneHandLoose));
}
