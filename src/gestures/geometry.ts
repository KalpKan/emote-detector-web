/**
 * Geometry helpers. `clamp`, `normalise`, `dist` and `angle` were ported from
 * the Python app (clash-emote-bot-python: src/body/pose_gesture_recognizer.py);
 * the box helpers were added for the face-overlap vetoes.
 *
 * Every landmark is a plain {x, y} in normalised image coordinates (0..1,
 * y grows downwards), exactly what MediaPipe hands back. Rules that need real
 * geometry scale x by the frame's aspect ratio first (`scaled`).
 */
export type Pt = { x: number; y: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };

export function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

/** Linearly scale `value` into [0, 1]; below `min` maps to 0, above `max` maps to 1. */
export function normalise(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Angle in degrees at point b, formed by a-b-c. `null` when a or c coincides with b. */
export function angle(a: Pt, b: Pt, c: Pt): number | null {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const len1 = Math.hypot(v1.x, v1.y);
  const len2 = Math.hypot(v2.x, v2.y);
  if (len1 === 0 || len2 === 0) return null;
  const dot = clamp((v1.x * v2.x + v1.y * v2.y) / (len1 * len2), -1, 1);
  return (Math.acos(dot) * 180) / Math.PI;
}

/** Points with x multiplied by the frame aspect (width / height), so distances are geometric. */
export function scaled(pts: readonly Pt[], aspect: number): Pt[] {
  return aspect === 1 ? [...pts] : pts.map((p) => ({ x: p.x * aspect, y: p.y }));
}

export function boundingBox(pts: readonly Pt[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** Whether `p` lies inside `box` grown by `margin` (a fraction of the box's own size) on every side. */
export function insideBox(p: Pt, box: Box, margin = 0): boolean {
  const mx = (box.x1 - box.x0) * margin;
  const my = (box.y1 - box.y0) * margin;
  return p.x >= box.x0 - mx && p.x <= box.x1 + mx && p.y >= box.y0 - my && p.y <= box.y1 + my;
}
