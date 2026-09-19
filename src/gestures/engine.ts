/**
 * Fuses the per-frame rule scores and runs the time-based dwell / release
 * state machine that decides when an emote fires.
 *
 * Per frame (`fuseScores`, pure):
 *   flex       = pose rule (five cues, weakest wins)
 *   thumbs_up  = hand rule (four cues, weakest wins)
 *   yawn       = face rule (mouth + eyes)
 *   a yawn >= 0.6 suppresses the other two (a yawning person's hands are not
 *   gestures); when a flex and a thumbs-up are both above the line the flex wins
 *   (a flexing fist often has its thumb up) unless the thumbs-up is clearly the
 *   stronger of the two.
 *
 * Then each gesture keeps two clocks in milliseconds (FIX round 1, D4; the port
 * counted frames, so a phone at 8 fps and a laptop at 25 fps behaved differently
 * and a held yawn re-fired every 2.3 s):
 *   charge  time the score has been >= ON_LINE (0.5); drains while < OFF_LINE
 *           (0.35) and holds in the band between, so one jittery frame cannot
 *           undo a hold. Reaching ON_MS[g] makes the gesture active: that frame
 *           is the edge that fires the emote.
 *   gone    while active, time the score has been < OFF_LINE minus time it has
 *           been back above the line. Reaching OFF_MS releases the gesture.
 * A held gesture therefore fires once, however long it is held, and cannot fire
 * again until it has really been dropped for OFF_MS and re-held for ON_MS. When
 * several gestures are active, only the highest-scoring one counts.
 *
 * `hint` names the weakest cue of the gesture that is closest to firing (its
 * score in the "almost" band) so the page can say what to change.
 */
import { type FaceMetrics, scoreYawnDetailed, type YawnCues } from "./face";
import { type FlexCues, scoreFlexDetailed } from "./flex";
import type { Pt } from "./geometry";
import { scoreThumbsUpDetailed, type ThumbCues } from "./thumbsUp";

export type Gesture = "flex" | "thumbs_up" | "yawn";
export const GESTURES: readonly Gesture[] = ["flex", "thumbs_up", "yawn"];

export type FrameInput = {
  pose?: readonly Pt[] | null;
  hands?: readonly (readonly Pt[])[] | null;
  face?: FaceMetrics | null;
  /** Frame width / height; defaults to 1 (square coordinates). */
  aspect?: number;
};

export type Cues = { flex: FlexCues; thumbs_up: ThumbCues; yawn: YawnCues };
export type Hint = { gesture: Gesture; cue: string; score: number };

export type FrameResult = {
  /** Fused scores after the conflict rules (0 when a gesture was dropped). */
  scores: Record<Gesture, number>;
  /** The cue breakdown behind each score. */
  cues: Cues;
  /** The winning active gesture, if any. */
  active: Gesture | null;
  /** The winning gesture if it became active on this very frame (edge), else null. */
  fired: Gesture | null;
  /** While nothing is active: the closest gesture and its weakest cue, or null when nothing is close. */
  hint: Hint | null;
};

/** How long a score must stay above the line before the emote fires. A yawn lasts seconds; talking does not. */
export const ON_MS: Record<Gesture, number> = { thumbs_up: 150, flex: 150, yawn: 400 };
/** How much longer a score must be below the line than above it before a held gesture is released. */
export const OFF_MS = 500;
export const ON_LINE = 0.5;
export const OFF_LINE = 0.35;
/** A gesture whose cues are all at least this, bar one, is "almost there" and earns a hint for that one. */
export const HINT_LINE = 0.5;

export type EngineOptions = {
  onMs?: Partial<Record<Gesture, number>>;
  offMs?: number;
};

export function fuseScores(input: FrameInput): { scores: Record<Gesture, number>; cues: Cues } {
  const ctx = { aspect: input.aspect ?? 1, face: input.face ?? null };
  const flex = input.pose && input.pose.length >= 17 ? scoreFlexDetailed(input.pose, ctx) : scoreFlexDetailed(null, ctx);
  const thumb = scoreThumbsUpDetailed(input.hands, ctx);
  const yawn = scoreYawnDetailed(input.face);

  const scores: Record<Gesture, number> = { flex: flex.score, thumbs_up: thumb.score, yawn: yawn.score };
  if (scores.yawn >= 0.6) {
    scores.thumbs_up = 0;
    scores.flex = 0;
  }
  // A curled arm beside the head is a flex even when the fist's thumb points up, unless the arm
  // is only half there and the thumbs-up is clear (a thumb up beside the cheek, elbow out of frame).
  if (scores.flex >= ON_LINE && scores.thumbs_up >= ON_LINE) {
    if (scores.thumbs_up - scores.flex > 0.25) scores.flex = 0;
    else scores.thumbs_up = 0;
  } else if (scores.flex >= ON_LINE) scores.thumbs_up = 0;
  return { scores, cues: { flex: flex.cues, thumbs_up: thumb.cues, yawn: yawn.cues } };
}

/**
 * The weakest cue of the gesture that is closest to firing, for the page's hint line.
 * "Close" means every cue but one is at least HINT_LINE: the score itself is the
 * weakest cue, so it cannot say how near the rest of the gesture is.
 */
export function weakestCue(scores: Record<Gesture, number>, cues: Cues): Hint | null {
  let best: Hint | null = null;
  for (const g of GESTURES) {
    if (scores[g] >= ON_LINE) continue;
    const entries = (Object.entries(cues[g]) as Array<[string, number]>).sort((a, b) => a[1] - b[1]);
    const closeness = entries.length > 1 ? entries[1][1] : entries[0][1];
    if (closeness >= HINT_LINE && (best === null || closeness > best.score)) best = { gesture: g, cue: entries[0][0], score: closeness };
  }
  return best;
}

type FsmState = { charge: number; gone: number; above: boolean; below: boolean; active: boolean };
const fresh = (): FsmState => ({ charge: 0, gone: 0, above: false, below: true, active: false });

export class GestureEngine {
  private readonly state: Record<Gesture, FsmState>;
  private readonly onMs: Record<Gesture, number>;
  private readonly offMs: number;
  private lastMs: number | null = null;

  constructor(options: EngineOptions = {}) {
    this.onMs = { ...ON_MS, ...options.onMs };
    this.offMs = options.offMs ?? OFF_MS;
    this.state = { flex: fresh(), thumbs_up: fresh(), yawn: fresh() };
  }

  reset(): void {
    for (const g of GESTURES) this.state[g] = fresh();
    this.lastMs = null;
  }

  /** @param nowMs a monotonic clock in milliseconds (performance.now() on the page, the clip position in tests). */
  update(input: FrameInput, nowMs: number): FrameResult {
    const { scores, cues } = fuseScores(input);
    // The first frame after a reset has no duration; a clock that jumps back is treated as one frame.
    const dt = this.lastMs === null || nowMs < this.lastMs ? 0 : Math.min(nowMs - this.lastMs, 250);
    this.lastMs = nowMs;
    const edges = new Set<Gesture>();
    const active: Gesture[] = [];

    for (const g of GESTURES) {
      const st = this.state[g];
      const score = scores[g];
      const above = score >= ON_LINE;
      const below = score < OFF_LINE;
      // The interval since the last frame is credited to a side only if the previous frame was
      // not on the opposite side, so the frame on which a gesture first appears (or disappears)
      // gets no credit for the time before it, while frames in the band keep a run going.
      if (above) st.charge = Math.min(this.onMs[g], st.charge + (st.below ? 0 : dt));
      else if (below) st.charge = Math.max(0, st.charge - (st.above ? 0 : dt));
      if (st.active) {
        // Leaky: time above the line pays back time below it, so a jittery hold never releases
        // while a real release (nothing but low frames) takes exactly OFF_MS.
        if (above) st.gone = Math.max(0, st.gone - (st.below ? 0 : dt));
        else if (below) st.gone += st.above ? 0 : dt;
        if (st.gone >= this.offMs) {
          st.active = false;
          st.charge = 0;
          st.gone = 0;
        }
      } else if (above && st.charge >= this.onMs[g]) {
        st.active = true;
        st.gone = 0;
        edges.add(g);
      }
      st.above = above;
      st.below = below;
      if (st.active) active.push(g);
    }

    active.sort((a, b) => scores[b] - scores[a]);
    const winner = active[0] ?? null;
    return {
      scores,
      cues,
      active: winner,
      fired: winner !== null && edges.has(winner) ? winner : null,
      hint: winner === null ? weakestCue(scores, cues) : null,
    };
  }
}
