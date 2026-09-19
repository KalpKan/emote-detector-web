/**
 * Fuses the per-frame rule scores and runs the time-based dwell / release
 * state machine that decides when an emote fires.
 *
 * Per frame (`rawScores`, pure):
 *   flex       = pose rule (five cues, weakest wins)
 *   thumbs_up  = hand rule (four cues, weakest wins)
 *   yawn       = face rule (mouth + eyes)
 *
 * The engine then smooths each raw score (and each cue) with an exponential
 * average of about SMOOTH_MS (FIX round 2, D1: the lite pose model's landmarks
 * jitter frame to frame in VIDEO mode, so the flex "height" cue of a thumbs-up
 * held beside the head read 0.2 one frame and 1.0 the next; resolving the
 * conflict per frame made the fused scores flip at 10 Hz and the two charge
 * clocks race) and only then applies the conflict rules (`resolveConflicts`,
 * pure):
 *   a yawn >= 0.6 suppresses the other two (a yawning person's hands are not
 *   gestures); when a flex and a thumbs-up are both above the line, the flex
 *   keeps its fist only if it scores at least FLEX_OVER_THUMB of the thumbs-up
 *   (a flexing fist often has its thumb up, flex-09, and every arm cue is
 *   there), otherwise the hand model's thumbs-up wins (a thumb up beside the
 *   cheek whose arm is only half a flex, thumbs_up-04).
 *   The fist is one fist: when one of that pair becomes active while the other
 *   is still active and still scoring, it takes over the hold silently (no
 *   edge), so one hold never plays two emotes.
 * `fuseScores` = `resolveConflicts(rawScores(...))` is the frame-level view the
 * still corpus and the report use.
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
 * `hint` names the weakest (smoothed) cue of the gesture that is closest to
 * firing (its score in the "almost" band) so the page can say what to change.
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
  /** Every gesture currently active (held), best first; the emote gate uses it to know whether a refused edge is still held. */
  actives: Gesture[];
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
/** Time constant of the exponential average the raw scores and cues go through before the conflict rules. */
export const SMOOTH_MS = 200;
/**
 * When a flex and a thumbs-up are both above the line, the flex must score at least this fraction
 * of the thumbs-up to keep its fist; a ratio, so it means the same on the first frames of a hold
 * (when both smoothed scores are still climbing) as on a settled one.
 */
export const FLEX_OVER_THUMB = 0.9;
/**
 * A thumbs-up whose arm is raised and bent beside the head (the flex's bend, beside and level cues
 * all there) may be a flex in the making: the hand model settles on a fist at once while the pose
 * model takes a few hundred milliseconds to see where the arm has stopped, so such a thumbs-up
 * must hold this long (instead of ON_MS.thumbs_up) before it fires. A thumbs-up at chest height
 * or in front of the camera is not delayed.
 */
export const THUMB_ON_ARM_MS = 450;

export type EngineOptions = {
  onMs?: Partial<Record<Gesture, number>>;
  offMs?: number;
  smoothMs?: number;
};

/** The three rules on one frame, before any conflict rule (pure). */
export function rawScores(input: FrameInput): { scores: Record<Gesture, number>; cues: Cues } {
  const ctx = { aspect: input.aspect ?? 1, face: input.face ?? null };
  const flex = input.pose && input.pose.length >= 17 ? scoreFlexDetailed(input.pose, ctx) : scoreFlexDetailed(null, ctx);
  const thumb = scoreThumbsUpDetailed(input.hands, ctx);
  const yawn = scoreYawnDetailed(input.face);
  return { scores: { flex: flex.score, thumbs_up: thumb.score, yawn: yawn.score }, cues: { flex: flex.cues, thumbs_up: thumb.cues, yawn: yawn.cues } };
}

/** The conflict rules on a set of (smoothed) scores: returns a new record, 0 where a gesture was dropped (pure). */
export function resolveConflicts(raw: Record<Gesture, number>): Record<Gesture, number> {
  const scores = { ...raw };
  if (scores.yawn >= 0.6) {
    scores.thumbs_up = 0;
    scores.flex = 0;
  }
  if (scores.flex >= ON_LINE && scores.thumbs_up >= ON_LINE) {
    // The hand model's thumbs-up over an arm that is less sure of being a flex is a thumbs-up: a
    // thumb up beside the cheek with the elbow bent or out of frame (thumbs_up-04, whose wrist-height
    // cue never settles). A flex as clear as the thumbs-up keeps its fist even when the thumb points
    // up (flex-09: every arm cue 1.0).
    if (scores.flex < FLEX_OVER_THUMB * scores.thumbs_up) scores.flex = 0;
    else scores.thumbs_up = 0;
  } else if (scores.flex >= ON_LINE) scores.thumbs_up = 0;
  return scores;
}

/** Frame-level fused scores (raw rules + conflict rules, no smoothing): what the still corpus measures. */
export function fuseScores(input: FrameInput): { scores: Record<Gesture, number>; cues: Cues } {
  const { scores, cues } = rawScores(input);
  return { scores: resolveConflicts(scores), cues };
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
  private readonly smoothMs: number;
  private lastMs: number | null = null;
  private smooth: { scores: Record<Gesture, number>; cues: Cues } | null = null;

  constructor(options: EngineOptions = {}) {
    this.onMs = { ...ON_MS, ...options.onMs };
    this.offMs = options.offMs ?? OFF_MS;
    this.smoothMs = options.smoothMs ?? SMOOTH_MS;
    this.state = { flex: fresh(), thumbs_up: fresh(), yawn: fresh() };
  }

  reset(): void {
    for (const g of GESTURES) this.state[g] = fresh();
    this.lastMs = null;
    this.smooth = null;
  }

  /** @param nowMs a monotonic clock in milliseconds (performance.now() on the page, the clip position in tests). */
  update(input: FrameInput, nowMs: number): FrameResult {
    const raw = rawScores(input);
    // The first frame after a reset has no duration; a clock that jumps back is treated as one frame.
    const dt = this.lastMs === null || nowMs < this.lastMs ? 0 : Math.min(nowMs - this.lastMs, 250);
    this.lastMs = nowMs;

    // Exponential average with a time constant, so it means the same at 8 fps and at 25 fps; the first
    // frame takes the raw values as they are.
    if (this.smooth === null || this.smoothMs <= 0) this.smooth = { scores: { ...raw.scores }, cues: cloneCues(raw.cues) };
    else {
      const a = 1 - Math.exp(-dt / this.smoothMs);
      for (const g of GESTURES) {
        this.smooth.scores[g] += a * (raw.scores[g] - this.smooth.scores[g]);
        const sc = this.smooth.cues[g] as unknown as Record<string, number>;
        const rc = raw.cues[g] as unknown as Record<string, number>;
        for (const k of Object.keys(sc)) sc[k] += a * (rc[k] - sc[k]);
      }
    }
    const scores = resolveConflicts(this.smooth.scores);
    const cues = cloneCues(this.smooth.cues);
    const edges = new Set<Gesture>();
    const active: Gesture[] = [];

    const armBesideHead = Math.min(cues.flex.bend, cues.flex.beside, cues.flex.level) >= HINT_LINE;
    for (const g of GESTURES) {
      const st = this.state[g];
      const score = scores[g];
      const above = score >= ON_LINE;
      const below = score < OFF_LINE;
      const onMs = g === "thumbs_up" && armBesideHead ? Math.max(this.onMs[g], THUMB_ON_ARM_MS) : this.onMs[g];
      // The interval since the last frame is credited to a side only if the previous frame was
      // not on the opposite side, so the frame on which a gesture first appears (or disappears)
      // gets no credit for the time before it, while frames in the band keep a run going.
      if (above) st.charge = Math.min(onMs, st.charge + (st.below ? 0 : dt));
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
      } else if (above && st.charge >= onMs) {
        st.active = true;
        st.gone = 0;
        // The fist is one fist (round 2): a flex emerging from a thumbs-up that is still held (or the
        // reverse) is the same hold re-read as the pose model settles, not a second gesture.
        const twin = g === "flex" ? "thumbs_up" : g === "thumbs_up" ? "flex" : null;
        const takeover = twin !== null && this.state[twin].active && this.smooth.scores[twin] >= ON_LINE;
        if (!takeover) edges.add(g);
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
      actives: active,
      fired: winner !== null && edges.has(winner) ? winner : null,
      hint: winner === null ? weakestCue(scores, cues) : null,
    };
  }
}

function cloneCues(c: Cues): Cues {
  return { flex: { ...c.flex }, thumbs_up: { ...c.thumbs_up }, yawn: { ...c.yawn } };
}
