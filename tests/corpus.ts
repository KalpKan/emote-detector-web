/**
 * Test corpus loaders shared by the gate tests (tests/stills.test.ts,
 * tests/clips.test.ts) and the report script (scripts/eval-corpus.ts).
 *
 * Stills: real MediaPipe landmarks from 95 labelled photos
 * (tests/fixtures/stills/*.json, ground truth in index.json / labels.json).
 *
 * Clips: tests/fixtures/clips/clips.json holds SCRIPTS (segments of stills with
 * transitions and seeded jitter); `synthesizeClip` turns one into 25 fps frames
 * deterministically. `runClip` feeds the frames through a GestureEngine + EmoteGate
 * exactly as src/main.ts does and returns every firing with its timestamp.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EmoteGate } from "../src/emotes";
import { faceMetrics, type FaceMetrics } from "../src/gestures/face";
import { type FrameInput, fuseScores, type Gesture, GestureEngine, GESTURES } from "../src/gestures/engine";
import type { Pt } from "../src/gestures/geometry";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export type StillKind = "ok" | "partial" | "occluded" | "neutral" | "hard" | "skip";
export type Still = {
  id: string;
  label: string;
  expected: Gesture | null;
  kind: StillKind;
  note: string;
  aspect: number;
  pose: Pt[] | null;
  hands: Pt[][];
  face: Pt[] | null;
};

const toPts = (a: number[][]): Pt[] => a.map(([x, y]) => ({ x, y }));

export function loadStills(): Still[] {
  const dir = join(FIXTURES, "stills");
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as {
    stills: Array<{ id: string; kind: StillKind; note: string; expected: Gesture | null }>;
  };
  const meta = new Map(index.stills.map((s) => [s.id, s]));
  return readdirSync(dir)
    .filter((f: string) => f.endsWith(".json") && f !== "index.json" && f !== "labels.json")
    .sort()
    .map((f: string) => {
      const raw = JSON.parse(readFileSync(join(dir, f), "utf8"));
      const m = meta.get(raw.id);
      if (!m) throw new Error(`still ${raw.id} missing from index.json`);
      return {
        id: raw.id,
        label: raw.label,
        expected: m.expected,
        kind: m.kind,
        note: m.note,
        aspect: raw.aspect,
        pose: raw.pose ? toPts(raw.pose) : null,
        hands: (raw.hands as number[][][]).map(toPts),
        face: raw.face ? toPts(raw.face) : null,
      };
    });
}

/** Frame-level scores for one still, exactly what the page computes before the FSM. */
export function scoreStill(s: Still): Record<Gesture, number> {
  return fuseScores({ pose: s.pose, hands: s.hands, face: faceMetrics(s.face, s.aspect), aspect: s.aspect }).scores;
}

export type Segment = { still: string; ms: number; transitionMs: number; talk?: boolean; look?: boolean };
/** `accept`: other emotes that also satisfy this event (a flex whose fist the hand model reads as a thumbs-up). */
export type ClipEvent = { gesture: Gesture; startMs: number; endMs: number; accept?: Gesture[] };
export type Clip = {
  id: string;
  kind: "positive" | "partial" | "occluded" | "neutral" | "hard";
  fps: number;
  jitter: number;
  seed: number;
  aspect: number;
  segments: Segment[];
  events: ClipEvent[];
  expectFires: Gesture[];
  acceptFires?: Gesture[];
  note: string;
};
export type Frame = { ms: number; pose: Pt[] | null; hands: Pt[][]; face: Pt[] | null; label: string };

export function loadClips(): Clip[] {
  return (JSON.parse(readFileSync(join(FIXTURES, "clips", "clips.json"), "utf8")) as { clips: Clip[] }).clips;
}

/** mulberry32: small seeded PRNG so every run sees identical jitter. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(next: () => number): number {
  const u = Math.max(next(), 1e-12);
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const lerp = (a: Pt[], b: Pt[], t: number): Pt[] => a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }));

/** Talking: open and close the inner lips (indices 13/14) with the eyes untouched. */
function talk(face: Pt[], phase: number): Pt[] {
  const f = face.map((p) => ({ ...p }));
  const open = 0.02 * (0.5 + 0.5 * Math.sin(phase)); // up to ~0.02 of frame height
  f[13] = { x: f[13].x, y: f[13].y - open / 2 };
  f[14] = { x: f[14].x, y: f[14].y + open / 2 };
  return f;
}
/** Looking around: slow drift of every landmark plus a small zoom. */
function look<T extends Pt[] | null>(pts: T, phase: number): T {
  if (!pts) return pts;
  const dx = 0.03 * Math.sin(phase);
  const dy = 0.015 * Math.sin(phase * 0.7);
  const k = 1 + 0.05 * Math.sin(phase * 0.5);
  return pts.map((p) => ({ x: 0.5 + (p.x - 0.5) * k + dx, y: 0.5 + (p.y - 0.5) * k + dy })) as T;
}

/** Deterministic 25 fps frames for a clip script. */
export function synthesizeClip(clip: Clip, stills = loadStills()): Frame[] {
  const byId = new Map(stills.map((s) => [s.id, s]));
  const next = rng(clip.seed);
  const frames: Frame[] = [];
  const dt = 1000 / clip.fps;
  let t = 0;
  let prev: Still | null = null;
  for (const seg of clip.segments) {
    const cur = byId.get(seg.still);
    if (!cur) throw new Error(`clip ${clip.id}: unknown still ${seg.still}`);
    const segStart = t;
    while (t < segStart + seg.ms) {
      const into = t - segStart;
      const tr = prev && seg.transitionMs > 0 ? Math.min(1, into / seg.transitionMs) : 1;
      // Tween when both frames have the part (and the same hand count); otherwise switch at the midpoint.
      const pick = <T extends Pt[] | null>(a: T, b: T): T => {
        if (tr >= 1) return b;
        if (a && b && a.length === b.length) return lerp(a, b, tr) as T;
        return tr < 0.5 ? a : b;
      };
      let pose = pick(prev?.pose ?? null, cur.pose);
      let face = pick(prev?.face ?? null, cur.face);
      let hands: Pt[][];
      if (tr >= 1 || !prev) hands = cur.hands;
      else if (prev.hands.length === cur.hands.length) hands = prev.hands.map((h, i) => lerp(h, cur.hands[i], tr));
      else hands = tr < 0.5 ? prev.hands : cur.hands;
      const phase = (into / 1000) * 2 * Math.PI * 0.6;
      if (seg.talk && face) face = talk(face, phase * 2.5);
      if (seg.look) {
        pose = look(pose, phase);
        face = look(face, phase);
        hands = hands.map((h) => look(h, phase));
      }
      const j = (p: Pt): Pt => ({ x: p.x + gaussian(next) * clip.jitter, y: p.y + gaussian(next) * clip.jitter });
      frames.push({
        ms: Math.round(t),
        pose: pose ? pose.map(j) : null,
        face: face ? face.map(j) : null,
        hands: hands.map((h) => h.map(j)),
        label: tr < 1 ? `${prev!.id}->${cur.id}` : cur.id,
      });
      t += dt;
    }
    prev = cur;
  }
  return frames;
}

export type Fire = { gesture: Gesture; ms: number };

/**
 * Runs engine inputs through the engine + emote gate exactly like src/main.ts
 * (`GestureEngine.update` → `EmoteGate.update` every frame) and returns every firing.
 */
export function runInputs(
  inputs: Array<{ ms: number; input: FrameInput }>,
  makeEngine: () => GestureEngine = () => new GestureEngine(),
): { fires: Fire[]; scores: Array<Record<Gesture, number>> } {
  const engine = makeEngine();
  const gate = new EmoteGate();
  const fires: Fire[] = [];
  const scores: Array<Record<Gesture, number>> = [];
  for (const { ms, input } of inputs) {
    const r = engine.update(input, ms);
    scores.push(r.scores);
    const emote = gate.update(r, ms);
    if (emote) fires.push({ gesture: emote.gesture, ms });
  }
  return { fires, scores };
}

/** Synthesized clip frames (raw face landmarks) through `runInputs`. */
export function runClip(
  clip: Clip,
  frames = synthesizeClip(clip),
  makeEngine: () => GestureEngine = () => new GestureEngine(),
): { fires: Fire[]; scores: Array<Record<Gesture, number>> } {
  return runInputs(
    frames.map((f) => ({ ms: f.ms, input: { pose: f.pose, hands: f.hands, face: faceMetrics(f.face, clip.aspect), aspect: clip.aspect } })),
    makeEngine,
  );
}

/** A VIDEO-mode landmark fixture (tests/fixtures/video/*.json): engine inputs per frame plus ground truth. */
export type VideoFrame = { ms: number; pose: number[][] | null; hands: number[][][]; face: FaceMetrics | null };
export type VideoClip = { id: string; aspect: number; fps: number; frames: Array<{ ms: number; input: FrameInput }>; clip: Clip };

export function loadVideoClips(): VideoClip[] {
  const dir = join(FIXTURES, "video");
  return readdirSync(dir)
    .filter((f: string) => f.endsWith(".json"))
    .sort()
    .map((f: string) => {
      const raw = JSON.parse(readFileSync(join(dir, f), "utf8")) as {
        clip: string;
        fps: number;
        aspect: number;
        durationMs: number;
        events: Array<{ gesture: Gesture; still: string; startMs: number; endMs: number; accept?: Gesture[] }>;
        frames: VideoFrame[];
      };
      const id = f.replace(/\.json$/, "");
      const events: ClipEvent[] = raw.events.map((e) => ({ gesture: e.gesture, startMs: e.startMs, endMs: e.endMs, ...(e.accept ? { accept: e.accept } : {}) }));
      const kind = events.length ? "positive" : "hard";
      const clip: Clip = {
        id,
        kind,
        fps: raw.fps,
        jitter: 0,
        seed: 0,
        aspect: raw.aspect,
        segments: [],
        events,
        expectFires: events.map((e) => e.gesture),
        note: `VIDEO-mode landmarks of ${raw.clip}`,
      };
      return {
        id,
        aspect: raw.aspect,
        fps: raw.fps,
        clip,
        frames: raw.frames.map((fr) => ({
          ms: fr.ms,
          input: { pose: fr.pose ? toPts(fr.pose) : null, hands: fr.hands.map(toPts), face: fr.face, aspect: raw.aspect },
        })),
      };
    });
}

/** VIDEO-mode fixture frames through `runInputs`. */
export function runFrames(frames: Array<{ ms: number; input: FrameInput }>, _aspect?: number): Fire[] {
  return runInputs(frames).fires;
}

export const FIRE_WINDOW_MS = 1000;

/** Judges one clip's firings against its ground truth. */
export type Judgement = {
  pass: boolean;
  problems: string[];
  latenciesMs: number[];
  /** Fires that matched an expected (or accepted) event. */
  matched: Fire[];
  /** Fires that matched nothing: false triggers. */
  unmatched: Fire[];
  /** Expected events that nothing matched (positive clips only; partial/occluded misses are tolerated). */
  missed: ClipEvent[];
};

export function judgeClip(clip: Clip, fires: Fire[]): Judgement {
  const problems: string[] = [];
  const latenciesMs: number[] = [];
  const accept = new Set(clip.acceptFires ?? []);
  const unmatched = [...fires];
  const matched: Fire[] = [];
  const missed: ClipEvent[] = [];
  for (const ev of clip.events) {
    // A fire counts for an event from 400 ms before the still is fully reached (the transition) until it leaves.
    const idx = unmatched.findIndex((f) => (f.gesture === ev.gesture || ev.accept?.includes(f.gesture)) && f.ms >= ev.startMs - 400 && f.ms <= ev.endMs);
    const expected = clip.expectFires.includes(ev.gesture) || accept.has(ev.gesture);
    if (idx === -1) {
      // A partial clip (gesture not visible to the landmarkers) or an occluded yawn tolerates a miss.
      if (clip.expectFires.includes(ev.gesture) && clip.kind === "positive") {
        problems.push(`missed ${ev.gesture} at ${ev.startMs} ms`);
        missed.push(ev);
      }
      continue;
    }
    const f = unmatched.splice(idx, 1)[0];
    matched.push(f);
    const latency = f.ms - ev.startMs;
    latenciesMs.push(latency);
    if (expected && latency > FIRE_WINDOW_MS) problems.push(`${ev.gesture} fired ${latency} ms after onset (> ${FIRE_WINDOW_MS})`);
  }
  for (const f of unmatched) {
    if (clip.kind === "hard") continue; // counted below
    problems.push(`false trigger: ${f.gesture} at ${f.ms} ms`);
  }
  if (clip.kind === "hard" && unmatched.length > 1) problems.push(`${unmatched.length} false triggers in the hard-negative clip (max 1)`);
  return { pass: problems.length === 0, problems, latenciesMs, matched, unmatched, missed };
}

/** Emote-level precision / recall per gesture over judged clips: tp = matched fires in positive clips, fn = missed positive events, fp = every unmatched fire in any clip. */
export function clipMetrics(judged: Array<{ clip: Clip; j: Judgement }>): GestureMetrics {
  const out = {} as GestureMetrics;
  for (const g of GESTURES) {
    const tp = judged.filter((x) => x.clip.kind === "positive").reduce((n, x) => n + x.j.matched.filter((f) => f.gesture === g).length, 0);
    const fn = judged.reduce((n, x) => n + x.j.missed.filter((e) => e.gesture === g).length, 0);
    const fp = judged.reduce((n, x) => n + x.j.unmatched.filter((f) => f.gesture === g).length, 0);
    out[g] = { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1 };
  }
  return out;
}

export type GestureMetrics = Record<Gesture, { tp: number; fp: number; fn: number; precision: number; recall: number }>;

/** Precision / recall per gesture over a set of (expected, fired) pairs. */
export function metrics(rows: Array<{ expected: Gesture | null; fired: Gesture[] }>): GestureMetrics {
  const out = {} as GestureMetrics;
  for (const g of GESTURES) {
    const tp = rows.filter((r) => r.expected === g && r.fired.includes(g)).length;
    const fp = rows.filter((r) => r.expected !== g && r.fired.includes(g)).length;
    const fn = rows.filter((r) => r.expected === g && !r.fired.includes(g)).length;
    out[g] = { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1 };
  }
  return out;
}

export { GESTURES, type FaceMetrics, type Gesture };
