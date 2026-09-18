/**
 * Demo mode for visitors without a webcam (or who would rather not switch it on).
 *
 * There is no video file: the demo replays the same hand-built landmark
 * fixtures the unit tests use, tweened between poses, through the exact
 * engine a webcam frame goes through. A stick figure is drawn from the
 * landmarks so you can see the flex, the thumbs-up and the yawn happen.
 */
import * as fx from "./fixtures";
import type { Pt } from "./gestures/geometry";

export type DemoFrame = {
  pose: Pt[];
  hands: Pt[][];
  face: Pt[];
  /** Which segment is playing, for the caption. */
  label: string;
};

type Segment = { label: string; seconds: number; pose: Pt[]; face: Pt[]; hands: Pt[][] };

const TRANSITION_S = 0.35;

/** The face fixture is drawn to its own scale; shrink it onto the stick figure's head (ratios are unchanged). */
function onHead(face: Pt[]): Pt[] {
  const k = 0.55;
  return face.map((p) => ({ x: 0.5 + (p.x - 0.5) * k, y: 0.22 + (p.y - 0.3) * k }));
}

function segments(): Segment[] {
  const neutral = { pose: fx.poseNeutral(), face: onHead(fx.face()), hands: [] as Pt[][] };
  return [
    { label: "Waiting…", seconds: 1.0, ...neutral },
    { label: "Thumbs up", seconds: 1.4, pose: fx.poseNeutral(), face: onHead(fx.face()), hands: [fx.handThumbsUp(0.12, 0.05)] },
    { label: "Relax", seconds: 0.9, ...neutral },
    { label: "Flex", seconds: 1.4, pose: fx.poseFlex(), face: onHead(fx.face()), hands: [] },
    { label: "Relax", seconds: 0.9, ...neutral },
    { label: "Yawn", seconds: 1.4, pose: fx.poseNeutral(), face: onHead(fx.faceYawn()), hands: [] },
    { label: "Relax", seconds: 0.9, ...neutral },
  ];
}

function lerpPts(a: Pt[], b: Pt[], t: number): Pt[] {
  return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }));
}

export class DemoSource {
  private readonly segs = segments();
  private readonly total = this.segs.reduce((s, seg) => s + seg.seconds, 0);

  /** Seconds for one full loop. */
  get loopSeconds(): number {
    return this.total;
  }

  frame(elapsedSeconds: number): DemoFrame {
    const t = ((elapsedSeconds % this.total) + this.total) % this.total;
    let start = 0;
    for (let i = 0; i < this.segs.length; i++) {
      const seg = this.segs[i];
      if (t < start + seg.seconds) {
        const prev = this.segs[(i + this.segs.length - 1) % this.segs.length];
        const into = t - start;
        const k = into < TRANSITION_S ? into / TRANSITION_S : 1;
        return {
          label: seg.label,
          pose: lerpPts(prev.pose, seg.pose, k),
          face: lerpPts(prev.face, seg.face, k),
          hands: seg.hands,
        };
      }
      start += seg.seconds;
    }
    const last = this.segs[this.segs.length - 1];
    return { label: last.label, pose: last.pose, face: last.face, hands: last.hands };
  }
}
