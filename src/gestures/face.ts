/**
 * Face metrics and the yawn ("Princess Yawn") rule, ported from the Python app
 * (src/behavior/behavior_analyzer.py `_extract_face_metrics` and `_score_yawn`).
 *
 * MediaPipe's FaceLandmarker returns the same 478 points (and the same indices)
 * as the FaceMesh solution the Python app used with `refine_landmarks=True`,
 * so the landmark numbers below are unchanged: 61/291 mouth corners, 13/14
 * upper/lower inner lip, 159/145 + 33/133 left eye, 386/374 + 362/263 right eye.
 *
 * The Python app measured in pixels inside the detected face box. Here the face
 * box is the bounding box of the 478 landmarks, and x is scaled by the frame's
 * aspect ratio so distances are geometric, not "normalised-coordinate" distances.
 */
import { clamp, dist, type Pt } from "./geometry";

export const FACE = {
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  UPPER_LIP: 13,
  LOWER_LIP: 14,
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374,
  RIGHT_EYE_OUTER: 362,
  RIGHT_EYE_INNER: 263,
} as const;

export type FaceMetrics = {
  mouthWidthRatio: number;
  mouthHeightRatio: number;
  mouthOpenRatio: number;
  leftEyeOpenRatio: number;
  rightEyeOpenRatio: number;
  avgEyeOpenRatio: number;
};

/**
 * @param face  478 normalised landmarks from FaceLandmarker.
 * @param aspect frame width / frame height (1 for square fixtures).
 */
export function faceMetrics(face: readonly Pt[] | null | undefined, aspect = 1): FaceMetrics | null {
  if (!face || face.length < 468) return null;
  const px = (p: Pt): Pt => ({ x: p.x * aspect, y: p.y });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of face) {
    const q = px(p);
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.y > maxY) maxY = q.y;
  }
  const w = Math.max(maxX - minX, 1e-5);
  const h = Math.max(maxY - minY, 1e-5);

  const mouthWidth = dist(px(face[FACE.MOUTH_LEFT]), px(face[FACE.MOUTH_RIGHT]));
  const mouthHeight = dist(px(face[FACE.UPPER_LIP]), px(face[FACE.LOWER_LIP]));

  const eyeRatio = (top: number, bottom: number, outer: number, inner: number): number => {
    const height = Math.abs(face[top].y - face[bottom].y);
    const width = Math.abs(px(face[outer]).x - px(face[inner]).x);
    return height / Math.max(width, 1e-5);
  };
  const leftEyeOpenRatio = eyeRatio(FACE.LEFT_EYE_TOP, FACE.LEFT_EYE_BOTTOM, FACE.LEFT_EYE_OUTER, FACE.LEFT_EYE_INNER);
  const rightEyeOpenRatio = eyeRatio(FACE.RIGHT_EYE_TOP, FACE.RIGHT_EYE_BOTTOM, FACE.RIGHT_EYE_OUTER, FACE.RIGHT_EYE_INNER);

  return {
    mouthWidthRatio: mouthWidth / w,
    mouthHeightRatio: mouthHeight / h,
    mouthOpenRatio: mouthHeight / Math.max(mouthWidth, 1e-5),
    leftEyeOpenRatio,
    rightEyeOpenRatio,
    avgEyeOpenRatio: (leftEyeOpenRatio + rightEyeOpenRatio) / 2,
  };
}

/** Wide-open mouth (tall relative to its width and to the face) with narrowed eyes. */
export function scoreYawn(metrics: FaceMetrics | null | undefined): number {
  if (!metrics) return 0;
  const mor = metrics.mouthOpenRatio;
  const mhr = metrics.mouthHeightRatio;
  const eye = metrics.avgEyeOpenRatio;
  if (mor > 0.55 && mhr > 0.2 && eye < 0.25) {
    const mouthComponent = (mor - 0.55) * 2.5 + (mhr - 0.2) * 2;
    const eyeComponent = (0.25 - eye) * 4;
    return clamp(mouthComponent + eyeComponent + 0.4, 0, 1);
  }
  return 0;
}
