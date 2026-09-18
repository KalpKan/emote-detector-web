/**
 * Geometry helpers, ported one-to-one from the Python app
 * (clash-emote-bot-python: src/body/pose_gesture_recognizer.py `_clamp`,
 * `_normalise`, `_distance_xy`, `_angle`).
 *
 * Every landmark is a plain {x, y} in normalised image coordinates (0..1,
 * y grows downwards), exactly what MediaPipe hands back.
 */
export type Pt = { x: number; y: number };

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
