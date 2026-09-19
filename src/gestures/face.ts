/**
 * Face metrics and the yawn ("Princess Yawn") rule.
 *
 * MediaPipe's FaceLandmarker returns the same 478 points (and the same indices)
 * as the FaceMesh solution the Python app used with `refine_landmarks=True`:
 * 61/291 mouth corners, 13/14 upper/lower inner lip, 159/145 + 33/133 left eye,
 * 386/374 + 362/263 right eye.
 *
 * The Python app measured in pixels inside the detected face box. Here the face
 * box is the bounding box of the 478 landmarks, and x is scaled by the frame's
 * aspect ratio so distances are geometric, not "normalised-coordinate" distances.
 *
 * The yawn rule (rewritten in FIX round 1; the port's hard gates missed real
 * yawns, see docs/reports/emotes.md D3): three soft cues. "mouth" (how tall the
 * inner-lip gap is relative to the mouth width) and "eyes" (how narrow the lids
 * are) are blended 0.6 / 0.4, and either near zero vetoes the yawn, so an open
 * mouth with open eyes (talking, a scream with the eyes open) scores nothing.
 * "brows" (brow-to-lid distance over the face height) caps the score when the
 * brows are knitted down, which is a scream or a frown, not a yawn (a yawn
 * relaxes the brows as the eyes close). Duration lives in the engine: a yawn
 * must hold for ON_MS.yawn before it fires.
 */
import { boundingBox, clamp, dist, normalise, type Box, type Pt } from "./geometry";

export const FACE = {
  FOREHEAD: 10,
  CHIN: 152,
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

/**
 * Eye aspect ratio (after Soukupova & Cech 2016) per eye: the lid gaps of five upper/lower
 * contour pairs over the corner-to-corner width, each gap a signed projection on the face's
 * down-vector (see `faceMetrics`), so jitter averages out across the ten pairs instead of
 * adding up as it would with absolute distances of a nearly shut lid (a closed lid's gap is
 * smaller than one pixel of jitter).
 */
const LEFT_EYE_EAR = { outer: 33, inner: 133, pairs: [[161, 163], [160, 144], [159, 145], [158, 153], [157, 154]] as Array<[number, number]> };
const RIGHT_EYE_EAR = { outer: 362, inner: 263, pairs: [[388, 390], [387, 373], [386, 374], [385, 380], [384, 381]] as Array<[number, number]> };
/** Inner-lip pairs (upper, lower) from the centre outwards; averaged the same way. */
const LIP_PAIRS: Array<[number, number]> = [[13, 14], [82, 87], [312, 317], [81, 178], [311, 402]];
/** Brow point over its upper-lid point, two per side: how far the brows sit above the eyes. */
const BROW_PAIRS: Array<[number, number]> = [[105, 159], [66, 158], [334, 386], [296, 385]];

/** Ratios are signed (a gap measured "up the face" is negative); only jitter makes them negative. */
export type FaceMetrics = {
  mouthWidthRatio: number;
  mouthHeightRatio: number;
  mouthOpenRatio: number;
  leftEyeOpenRatio: number;
  rightEyeOpenRatio: number;
  avgEyeOpenRatio: number;
  /** Brow-to-upper-lid distance over the face height (forehead to chin). */
  browLiftRatio: number;
  /** Bounding box of the face landmarks in normalised (unscaled) coordinates. */
  box: Box;
};

export type YawnCues = { mouth: number; eyes: number; brows: number };
export type YawnScore = { score: number; cues: YawnCues };

/**
 * @param face  478 normalised landmarks from FaceLandmarker.
 * @param aspect frame width / frame height (1 for square fixtures).
 */
export function faceMetrics(face: readonly Pt[] | null | undefined, aspect = 1): FaceMetrics | null {
  if (!face || face.length < 468) return null;
  const px = (p: Pt): Pt => ({ x: p.x * aspect, y: p.y });

  const raw = boundingBox(face);
  const w = Math.max((raw.x1 - raw.x0) * aspect, 1e-5);
  const h = Math.max(raw.y1 - raw.y0, 1e-5);

  // Every gap is the SIGNED projection of (lower point - upper point) onto the face's own
  // down-vector (forehead 10 -> chin 152). Signed, so symmetric landmark jitter on a nearly
  // shut lid averages towards the true gap instead of folding into a positive offset;
  // face-relative, so a tilted or sideways face measures the same.
  const forehead = px(face[FACE.FOREHEAD]);
  const chin = px(face[FACE.CHIN]);
  const downLen = Math.max(dist(forehead, chin), 1e-5);
  const down = { x: (chin.x - forehead.x) / downLen, y: (chin.y - forehead.y) / downLen };
  const gapDown = (top: Pt, bottom: Pt): number => (bottom.x - top.x) * down.x + (bottom.y - top.y) * down.y;

  const mouthLeft = px(face[FACE.MOUTH_LEFT]);
  const mouthRight = px(face[FACE.MOUTH_RIGHT]);
  const mouthWidth = dist(mouthLeft, mouthRight);
  const mouthHeight = LIP_PAIRS.reduce((sum, [top, bottom]) => sum + gapDown(px(face[top]), px(face[bottom])), 0) / LIP_PAIRS.length;

  const eyeRatio = (eye: typeof LEFT_EYE_EAR): number => {
    const width = Math.max(dist(px(face[eye.outer]), px(face[eye.inner])), 1e-5);
    const gaps = eye.pairs.reduce((sum, [top, bottom]) => sum + gapDown(px(face[top]), px(face[bottom])), 0);
    return gaps / (eye.pairs.length * width);
  };
  const leftEyeOpenRatio = eyeRatio(LEFT_EYE_EAR);
  const rightEyeOpenRatio = eyeRatio(RIGHT_EYE_EAR);
  const browLift = BROW_PAIRS.reduce((sum, [brow, lid]) => sum + gapDown(px(face[brow]), px(face[lid])), 0) / BROW_PAIRS.length;

  return {
    mouthWidthRatio: mouthWidth / w,
    mouthHeightRatio: mouthHeight / h,
    mouthOpenRatio: mouthHeight / Math.max(mouthWidth, 1e-5),
    leftEyeOpenRatio,
    rightEyeOpenRatio,
    avgEyeOpenRatio: (leftEyeOpenRatio + rightEyeOpenRatio) / 2,
    browLiftRatio: browLift / downLen,
    box: raw,
  };
}

/** Mean inner-lip gap 0.28-0.55 of the mouth width ramps 0..1 (real yawns measure 0.41-0.82, talking under 0.3). */
const MOUTH_MIN = 0.28;
const MOUTH_MAX = 0.55;
/** Eye aspect ratio: under 0.06 is shut, over 0.14 is open (yawning eyes measure 0.00-0.06, open eyes 0.15-0.36). */
const EYES_SHUT = 0.06;
const EYES_OPEN = 0.14;
/** Brow-to-lid distance / face height: a yawn relaxes the brows (0.116-0.196); a scream or frown knits them down (0.07-0.107). */
const BROWS_DOWN = 0.1;
const BROWS_UP = 0.125;

export function scoreYawnDetailed(metrics: FaceMetrics | null | undefined): YawnScore {
  if (!metrics) return { score: 0, cues: { mouth: 0, eyes: 0, brows: 0 } };
  const mouth = normalise(metrics.mouthOpenRatio, MOUTH_MIN, MOUTH_MAX);
  const eyes = 1 - normalise(metrics.avgEyeOpenRatio, EYES_SHUT, EYES_OPEN);
  const brows = normalise(metrics.browLiftRatio, BROWS_DOWN, BROWS_UP);
  const cues = { mouth, eyes, brows };
  // The mouth must be at least partly open. A very open mouth or tightly shut eyes lifts the
  // score; eyes less than half shut cap it below the firing line (talking, a scream with the eyes
  // open), and so do knitted brows (a scream with the eyes squeezed shut). Soft caps rather than
  // hard gates, so one jittery frame lands in the engine's hysteresis band instead of at zero.
  if (mouth < 0.25) return { score: 0, cues };
  return { score: clamp(Math.min(0.6 * mouth + 0.4 * eyes, eyes / 0.6, 0.3 + 0.7 * brows), 0, 1), cues };
}

/** Wide-open mouth with narrowed eyes, 0..1. */
export function scoreYawn(metrics: FaceMetrics | null | undefined): number {
  return scoreYawnDetailed(metrics).score;
}
