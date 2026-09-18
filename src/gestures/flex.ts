/**
 * Flex ("Goblin Muscle") rule, ported from the Python app
 * (src/body/pose_gesture_recognizer.py `_score_flex` / `_score_arm_flex`).
 *
 * A flex is an arm bent to about 60 degrees at the elbow, with the wrist
 * raised above the shoulder and close to the head. Each of the three cues
 * becomes a 0..1 score and they are blended 0.45 / 0.35 / 0.2; a strong
 * bend plus a clearly raised wrist is enough on its own.
 */
import { angle, clamp, dist, normalise, type Pt } from "./geometry";

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

export function scoreArmFlex(
  pose: readonly Pt[],
  shoulderIdx: number,
  elbowIdx: number,
  wristIdx: number,
  headPoints: readonly Pt[],
): number {
  const shoulder = pose[shoulderIdx];
  const elbow = pose[elbowIdx];
  const wrist = pose[wristIdx];
  if (!shoulder || !elbow || !wrist) return 0;

  const elbowAngle = angle(shoulder, elbow, wrist);
  if (elbowAngle === null) return 0;

  // Strong bend towards 60 degrees gives the highest confidence.
  const angleScore = normalise(120 - Math.abs(elbowAngle - 60), 20, 80);

  // Wrist raised above the shoulder (y grows downwards).
  const heightScore = normalise(shoulder.y - wrist.y, 0.05, 0.28);

  // Wrist close to the head (nose / eyes): small distance => strong score.
  let headScore = 0;
  if (headPoints.length > 0) {
    const closest = Math.min(...headPoints.map((p) => dist(wrist, p)));
    headScore = normalise(0.28 - closest, 0.05, 0.28);
  }

  let combined = 0.45 * angleScore + 0.35 * heightScore + 0.2 * headScore;
  if (angleScore > 0.8 && heightScore > 0.6) {
    combined = Math.max(combined, Math.min(angleScore, heightScore));
  }
  return clamp(combined, 0, 1);
}

/** Best flex score over both arms, 0 when the pose is missing. */
export function scoreFlex(pose: readonly Pt[] | null | undefined): number {
  if (!pose || pose.length < 17) return 0;
  const headPoints = [pose[POSE.NOSE], pose[POSE.LEFT_EYE], pose[POSE.RIGHT_EYE]].filter(
    (p): p is Pt => p !== undefined,
  );
  const left = scoreArmFlex(pose, POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST, headPoints);
  const right = scoreArmFlex(pose, POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST, headPoints);
  return Math.max(left, right);
}
