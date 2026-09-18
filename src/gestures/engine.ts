/**
 * Fuses the per-frame rule scores the way the Python app's
 * `BehaviorAnalyzer.analyze` did, then runs its dwell / cool-down state machine.
 *
 * Per frame:
 *   flex       = pose rule, kept only when a pose is present and the score >= 0.5
 *   thumbs_up  = max(strict rule, loose rule if loose >= 0.6); dropped when < 0.6
 *                or while the flex rule scores >= 0.4 (a raised arm is not a thumbs-up)
 *   yawn       = face rule; a yawn >= 0.6 suppresses the other two
 * Then each gesture's FSM: score >= 0.5 for `dwell` consecutive frames -> active;
 * `cooldownFrames` consecutive frames below 0.5 -> inactive. When several are
 * active, only the highest-scoring one counts.
 *
 * One deliberate fix over the Python code: a gesture that vanishes entirely from
 * a frame (score 0) counts as a miss there. In Python an absent gesture kept its
 * FSM state, so it could re-activate later with no dwell at all.
 */
import { type FaceMetrics, scoreYawn } from "./face";
import { scoreFlex } from "./flex";
import type { Pt } from "./geometry";
import { scoreThumbLoose, scoreThumbStrict } from "./thumbsUp";

export type Gesture = "flex" | "thumbs_up" | "yawn";
export const GESTURES: readonly Gesture[] = ["flex", "thumbs_up", "yawn"];

export type FrameInput = {
  pose?: readonly Pt[] | null;
  hands?: readonly (readonly Pt[])[] | null;
  face?: FaceMetrics | null;
};

export type FrameResult = {
  /** Fused scores after the conflict rules (0 when a gesture was dropped). */
  scores: Record<Gesture, number>;
  /** The winning active gesture, if any. */
  active: Gesture | null;
  /** The winning gesture if it became active on this very frame (edge), else null. */
  fired: Gesture | null;
};

type FsmState = { hit: number; miss: number; active: boolean };

export type EngineOptions = {
  dwell?: Partial<Record<Gesture, number>>;
  cooldownFrames?: number;
};

const DEFAULT_DWELL: Record<Gesture, number> = { thumbs_up: 3, flex: 3, yawn: 3 };

/** Pure fusion step (no state), exported for tests. */
export function fuseScores(input: FrameInput): Record<Gesture, number> {
  const posePresent = Boolean(input.pose && input.pose.length >= 17);
  const handsPresent = Boolean(input.hands && input.hands.length > 0);

  const poseFlex = posePresent ? scoreFlex(input.pose) : 0;
  const flex = posePresent && poseFlex >= 0.5 ? poseFlex : 0;

  let thumb = 0;
  if (handsPresent) {
    const strict = scoreThumbStrict(input.hands);
    const loose = scoreThumbLoose(input.hands);
    thumb = Math.max(strict, loose >= 0.6 ? loose : 0);
  }

  let yawn = scoreYawn(input.face);
  if (input.face && input.face.avgEyeOpenRatio >= 0.25) yawn = 0;

  const scores: Record<Gesture, number> = { flex, thumbs_up: thumb, yawn };
  if (scores.yawn >= 0.6) {
    scores.thumbs_up = 0;
    scores.flex = 0;
  }
  if (scores.thumbs_up > 0 && (scores.thumbs_up < 0.6 || poseFlex >= 0.4)) {
    scores.thumbs_up = 0;
  }
  return scores;
}

export class GestureEngine {
  private readonly state: Record<Gesture, FsmState>;
  private readonly dwell: Record<Gesture, number>;
  private readonly cooldownFrames: number;

  constructor(options: EngineOptions = {}) {
    this.dwell = { ...DEFAULT_DWELL, ...options.dwell };
    this.cooldownFrames = options.cooldownFrames ?? 3;
    this.state = {
      flex: { hit: 0, miss: 0, active: false },
      thumbs_up: { hit: 0, miss: 0, active: false },
      yawn: { hit: 0, miss: 0, active: false },
    };
  }

  reset(): void {
    for (const g of GESTURES) this.state[g] = { hit: 0, miss: 0, active: false };
  }

  update(input: FrameInput): FrameResult {
    const scores = fuseScores(input);
    const edges = new Set<Gesture>();
    const active: Gesture[] = [];

    for (const g of GESTURES) {
      const st = this.state[g];
      const score = scores[g];
      if (score >= 0.5) {
        st.hit += 1;
        st.miss = 0;
        if (!st.active && st.hit >= this.dwell[g]) {
          st.active = true;
          edges.add(g);
        }
      } else {
        st.miss += 1;
        if (st.miss >= this.cooldownFrames) {
          st.active = false;
          st.hit = 0;
        }
      }
      if (st.active) active.push(g);
    }

    active.sort((a, b) => scores[b] - scores[a]);
    const winner = active[0] ?? null;
    return { scores, active: winner, fired: winner !== null && edges.has(winner) ? winner : null };
  }
}
