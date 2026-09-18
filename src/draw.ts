/** Canvas overlay: the landmarks the rules actually read, drawn as a light skeleton. */
import { FACE } from "./gestures/face";
import { POSE } from "./gestures/flex";
import type { Pt } from "./gestures/geometry";

const POSE_LINES: Array<[number, number]> = [
  [POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER],
  [POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW],
  [POSE.LEFT_ELBOW, POSE.LEFT_WRIST],
  [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW],
  [POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST],
];

const HAND_LINES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

const FACE_POINTS = [
  FACE.MOUTH_LEFT, FACE.MOUTH_RIGHT, FACE.UPPER_LIP, FACE.LOWER_LIP,
  FACE.LEFT_EYE_TOP, FACE.LEFT_EYE_BOTTOM, FACE.LEFT_EYE_OUTER, FACE.LEFT_EYE_INNER,
  FACE.RIGHT_EYE_TOP, FACE.RIGHT_EYE_BOTTOM, FACE.RIGHT_EYE_OUTER, FACE.RIGHT_EYE_INNER,
];

export type Overlay = {
  pose?: readonly Pt[] | null;
  hands?: readonly (readonly Pt[])[] | null;
  face?: readonly Pt[] | null;
  /** Draw a head circle and torso hint (demo mode, where there is no video). */
  figure?: boolean;
};

export function drawOverlay(ctx: CanvasRenderingContext2D, o: Overlay): void {
  const { width: w, height: h } = ctx.canvas;
  const X = (p: Pt) => p.x * w;
  const Y = (p: Pt) => p.y * h;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const lines = (pts: readonly Pt[], pairs: Array<[number, number]>, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [a, b] of pairs) {
      const pa = pts[a];
      const pb = pts[b];
      if (!pa || !pb) continue;
      ctx.moveTo(X(pa), Y(pa));
      ctx.lineTo(X(pb), Y(pb));
    }
    ctx.stroke();
  };
  const dots = (pts: readonly Pt[], color: string, r: number) => {
    ctx.fillStyle = color;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(X(p), Y(p), r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (o.pose && o.pose.length >= 17) {
    if (o.figure) {
      const nose = o.pose[POSE.NOSE];
      const ls = o.pose[POSE.LEFT_SHOULDER];
      const rs = o.pose[POSE.RIGHT_SHOULDER];
      let cx = X(nose);
      let cy = Y(nose) + h * 0.04;
      let headR = Math.abs(X(ls) - X(rs)) * 0.4;
      if (o.face && o.face.length >= 468) {
        const xs = o.face.map(X);
        const ys = o.face.map(Y);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        cx = (minX + maxX) / 2;
        cy = (minY + maxY) / 2;
        headR = Math.max(maxX - minX, maxY - minY) * 0.6;
      }
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(2, w / 200);
      ctx.beginPath();
      ctx.arc(cx, cy, headR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((X(ls) + X(rs)) / 2, Y(ls));
      ctx.lineTo((X(ls) + X(rs)) / 2, Y(ls) + headR * 3);
      ctx.stroke();
    }
    lines(o.pose, POSE_LINES, "rgba(255, 196, 61, 0.9)", Math.max(3, w / 160));
    dots([o.pose[POSE.LEFT_WRIST], o.pose[POSE.RIGHT_WRIST], o.pose[POSE.LEFT_ELBOW], o.pose[POSE.RIGHT_ELBOW]], "#ffc43d", Math.max(4, w / 120));
  }

  if (o.hands) {
    for (const hand of o.hands) {
      lines(hand, HAND_LINES, "rgba(102, 227, 255, 0.9)", Math.max(2, w / 240));
      dots(hand, "#66e3ff", Math.max(2.5, w / 220));
    }
  }

  if (o.face && o.face.length >= 468) {
    const pts = FACE_POINTS.map((i) => o.face![i]).filter(Boolean);
    dots(pts, "#ff7ab6", Math.max(2.5, w / 220));
    // Mouth outline: left corner -> upper lip -> right corner -> lower lip.
    lines(
      o.face,
      [
        [FACE.MOUTH_LEFT, FACE.UPPER_LIP],
        [FACE.UPPER_LIP, FACE.MOUTH_RIGHT],
        [FACE.MOUTH_RIGHT, FACE.LOWER_LIP],
        [FACE.LOWER_LIP, FACE.MOUTH_LEFT],
      ],
      "rgba(255, 122, 182, 0.8)",
      Math.max(2, w / 260),
    );
  }
}
