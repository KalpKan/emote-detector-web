/**
 * Hand-built landmark fixtures in normalised coordinates (y grows downwards).
 * They are used by the unit tests and replayed by the page's demo mode, so the
 * demo exercises exactly the code path a webcam frame takes.
 *
 * Only the indices the rules read are meaningful; every other landmark sits at a
 * plausible default so bounding boxes and drawings still make sense.
 */
import { FACE } from "./gestures/face";
import { POSE } from "./gestures/flex";
import type { Pt } from "./gestures/geometry";
import { HAND } from "./gestures/thumbsUp";

const pt = (x: number, y: number): Pt => ({ x, y });

function fill(n: number, base: Pt): Pt[] {
  return Array.from({ length: n }, () => ({ ...base }));
}

/** 33-point pose, standing upright, arms hanging. */
export function poseNeutral(): Pt[] {
  const p = fill(33, pt(0.5, 0.6));
  p[POSE.NOSE] = pt(0.5, 0.2);
  p[POSE.LEFT_EYE] = pt(0.52, 0.18);
  p[POSE.RIGHT_EYE] = pt(0.48, 0.18);
  p[POSE.LEFT_SHOULDER] = pt(0.62, 0.45);
  p[POSE.RIGHT_SHOULDER] = pt(0.38, 0.45);
  p[POSE.LEFT_ELBOW] = pt(0.64, 0.62);
  p[POSE.RIGHT_ELBOW] = pt(0.36, 0.62);
  p[POSE.LEFT_WRIST] = pt(0.65, 0.8);
  p[POSE.RIGHT_WRIST] = pt(0.35, 0.8);
  return p;
}

/** Left arm bent to ~70 degrees with the fist raised beside the head. */
export function poseFlex(): Pt[] {
  const p = poseNeutral();
  p[POSE.LEFT_ELBOW] = pt(0.75, 0.42);
  p[POSE.LEFT_WRIST] = pt(0.62, 0.22);
  return p;
}

/** 21-point hand: thumb straight up, four fingers folded. */
export function handThumbsUp(offsetX = 0, offsetY = 0): Pt[] {
  const h = fill(21, pt(0.55, 0.7));
  h[HAND.WRIST] = pt(0.5, 0.8);
  h[HAND.THUMB_IP] = pt(0.5, 0.62);
  h[HAND.THUMB_TIP] = pt(0.5, 0.55);
  h[HAND.INDEX_MCP] = pt(0.55, 0.7);
  const xs = [0.55, 0.6, 0.65, 0.7];
  const joints: Array<[number, number]> = [
    [HAND.INDEX_PIP, HAND.INDEX_TIP],
    [HAND.MIDDLE_PIP, HAND.MIDDLE_TIP],
    [HAND.RING_PIP, HAND.RING_TIP],
    [HAND.PINKY_PIP, HAND.PINKY_TIP],
  ];
  joints.forEach(([pip, tip], i) => {
    h[pip] = pt(xs[i], 0.62);
    h[tip] = pt(xs[i], 0.76);
  });
  return h.map((q) => pt(q.x + offsetX, q.y + offsetY));
}

/** 21-point hand: open palm, fingers up, thumb out to the side. */
export function handOpenPalm(): Pt[] {
  const h = fill(21, pt(0.55, 0.7));
  h[HAND.WRIST] = pt(0.5, 0.8);
  h[HAND.THUMB_IP] = pt(0.42, 0.72);
  h[HAND.THUMB_TIP] = pt(0.38, 0.68);
  h[HAND.INDEX_MCP] = pt(0.55, 0.7);
  const xs = [0.55, 0.6, 0.65, 0.7];
  const joints: Array<[number, number]> = [
    [HAND.INDEX_PIP, HAND.INDEX_TIP],
    [HAND.MIDDLE_PIP, HAND.MIDDLE_TIP],
    [HAND.RING_PIP, HAND.RING_TIP],
    [HAND.PINKY_PIP, HAND.PINKY_TIP],
  ];
  joints.forEach(([pip, tip], i) => {
    h[pip] = pt(xs[i], 0.62);
    h[tip] = pt(xs[i], 0.5);
  });
  return h;
}

/** Thumbs-up flipped vertically around the wrist: a thumbs-down. */
export function handThumbsDown(): Pt[] {
  return handThumbsUp().map((q) => pt(q.x, 1.6 - q.y));
}

/**
 * 478-point face. `mouthOpen` sets the inner-lip gap; `eyesOpen` the lid gap.
 * Defaults are a relaxed face: mouth closed, eyes open.
 */
export function face(options: { mouthOpen?: number; eyesOpen?: number } = {}): Pt[] {
  const mouthOpen = options.mouthOpen ?? 0.01;
  const eyesOpen = options.eyesOpen ?? 0.03;
  const f = fill(478, pt(0.5, 0.3));
  // Face box corners (top of forehead, chin, cheeks).
  f[10] = pt(0.5, 0.1);
  f[152] = pt(0.5, 0.5);
  f[234] = pt(0.3, 0.3);
  f[454] = pt(0.7, 0.3);
  // Mouth.
  f[FACE.MOUTH_LEFT] = pt(0.42, 0.42);
  f[FACE.MOUTH_RIGHT] = pt(0.58, 0.42);
  f[FACE.UPPER_LIP] = pt(0.5, 0.42 - mouthOpen / 2);
  f[FACE.LOWER_LIP] = pt(0.5, 0.42 + mouthOpen / 2);
  // Eyes (0.08 wide).
  f[FACE.LEFT_EYE_OUTER] = pt(0.38, 0.245);
  f[FACE.LEFT_EYE_INNER] = pt(0.46, 0.245);
  f[FACE.LEFT_EYE_TOP] = pt(0.42, 0.245 - eyesOpen / 2);
  f[FACE.LEFT_EYE_BOTTOM] = pt(0.42, 0.245 + eyesOpen / 2);
  f[FACE.RIGHT_EYE_OUTER] = pt(0.62, 0.245);
  f[FACE.RIGHT_EYE_INNER] = pt(0.54, 0.245);
  f[FACE.RIGHT_EYE_TOP] = pt(0.58, 0.245 - eyesOpen / 2);
  f[FACE.RIGHT_EYE_BOTTOM] = pt(0.58, 0.245 + eyesOpen / 2);
  return f;
}

/** Wide yawn: tall mouth, narrowed eyes. */
export function faceYawn(): Pt[] {
  return face({ mouthOpen: 0.12, eyesOpen: 0.01 });
}

/** Mouth wide open but eyes wide open too (talking / surprised): not a yawn. */
export function faceOpenMouthEyesOpen(): Pt[] {
  return face({ mouthOpen: 0.12, eyesOpen: 0.03 });
}
