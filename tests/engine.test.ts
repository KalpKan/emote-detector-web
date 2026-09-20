import { describe, expect, it } from "vitest";
import { COOLDOWN_MS, EmoteGate, EMOTES, emoteForGesture, GAP_MS } from "../src/emotes";
import { faceMetrics } from "../src/gestures/face";
import { fuseScores, type Gesture, GestureEngine, OFF_LINE, OFF_MS, ON_MS, SMOOTH_MS, THUMB_SETTLE_MS, THUMB_WAIT_MAX_MS } from "../src/gestures/engine";
import { POSE } from "../src/gestures/flex";
import * as fx from "../src/fixtures";

const thumbFrame = { hands: [fx.handThumbsUp()] };
const flexFrame = { pose: fx.poseFlex() };
const yawnFrame = { face: faceMetrics(fx.faceYawn()) };
const empty = {};

/** Feeds `frame` every `dt` ms from `from` to `to` (exclusive) and returns the fire timestamps. */
function drive(e: GestureEngine, frame: object, from: number, to: number, dt: number): number[] {
  const fires: number[] = [];
  for (let t = from; t < to; t += dt) if (e.update(frame, t).fired) fires.push(t);
  return fires;
}

describe("fuseScores (conflict rules)", () => {
  it("scores each gesture from its own input", () => {
    expect(fuseScores(thumbFrame).scores.thumbs_up).toBeGreaterThanOrEqual(0.5);
    expect(fuseScores(flexFrame).scores.flex).toBeGreaterThanOrEqual(0.5);
    expect(fuseScores(yawnFrame).scores.yawn).toBeGreaterThanOrEqual(0.5);
    expect(fuseScores(empty).scores).toEqual({ flex: 0, thumbs_up: 0, yawn: 0 });
  });
  it("a strong yawn suppresses thumbs-up and flex", () => {
    const s = fuseScores({ ...thumbFrame, ...flexFrame, ...yawnFrame }).scores;
    expect(s.yawn).toBeGreaterThanOrEqual(0.6);
    expect(s.thumbs_up).toBe(0);
    expect(s.flex).toBe(0);
  });
  it("a thumbs-up beside a bent elbow is still a thumbs-up (no flex veto)", () => {
    const s = fuseScores({ ...thumbFrame, pose: fx.poseNeutral() }).scores;
    expect(s.thumbs_up).toBeGreaterThanOrEqual(0.5);
  });
  it("a strong flex whose fist has the thumb up is a flex", () => {
    const s = fuseScores({ ...thumbFrame, ...flexFrame }).scores;
    expect(s.flex).toBeGreaterThanOrEqual(0.5);
    expect(s.thumbs_up).toBe(0);
  });
  it("a clear thumbs-up beside a half-raised arm is a thumbs-up, not a flex (thumbs_up-04 through the live pipeline)", () => {
    const pose = fx.poseFlex();
    pose[15] = { x: 0.72, y: 0.376 }; // fist only just above the shoulder: the flex is weak (about 0.55)
    const s = fuseScores({ ...thumbFrame, pose }).scores;
    expect(s.thumbs_up).toBeGreaterThanOrEqual(0.5);
    expect(s.flex).toBe(0);
  });
  it("flex needs a pose; a hand alone never flexes", () => {
    expect(fuseScores({ hands: [fx.handThumbsUp()] }).scores.flex).toBe(0);
  });
  it("a face with open eyes cannot yawn", () => {
    expect(fuseScores({ face: faceMetrics(fx.faceOpenMouthEyesOpen()) }).scores.yawn).toBe(0);
  });
  it("reports the cue scores behind every gesture", () => {
    const { cues } = fuseScores({ ...thumbFrame, ...flexFrame });
    expect(Object.keys(cues.flex).length).toBeGreaterThan(1);
    expect(Object.keys(cues.thumbs_up).length).toBeGreaterThan(1);
    expect(Object.keys(cues.yawn).length).toBeGreaterThan(0);
  });
});

describe("GestureEngine smoothing before the conflict rules (round 2, D1)", () => {
  it("a perfect thumbs-up over a flex reading that jitters 0.5-0.95 frame to frame (VIDEO-mode pose) fires Thumbs Up, never Goblin Muscle", () => {
    // thumbs_up-04 through the live pipeline: hand cues all 1.0 on every frame; the pose model's
    // wrist-height cue flips between about 0.5 and 0.95 on consecutive 100 ms samples of a static image.
    const strong = fx.poseFlex();
    const weak = fx.poseFlex();
    weak[15] = { x: 0.72, y: 0.376 }; // fist only just above the shoulder: flex about 0.55
    const e = new GestureEngine();
    const fired: string[] = [];
    for (let t = 0; t < 3000; t += 100) {
      const r = e.update({ hands: [fx.handThumbsUp()], pose: t % 200 === 0 ? strong : weak, aspect: 1 }, t);
      if (r.fired) fired.push(r.fired);
    }
    expect(fired).toEqual(["thumbs_up"]);
  });
  it("a steady strong flex whose fist reads as a thumbs-up fires Goblin Muscle only (flex-09)", () => {
    const e = new GestureEngine();
    const fired: string[] = [];
    for (let t = 0; t < 3000; t += 100) {
      const r = e.update({ hands: [fx.handThumbsUp()], pose: fx.poseFlex(), aspect: 1 }, t);
      if (r.fired) fired.push(r.fired);
    }
    expect(fired).toEqual(["flex"]);
  });
  describe("a stale pose at a cut (round 3, D1: flex-09 through the real pipeline)", () => {
    // The hand model settles on the first frame; the pose model (lite, VIDEO mode) needs a few hundred
    // milliseconds to see where the arms went. Until its wrists agree with the hands, the pose is stale:
    // a thumbs-up must wait for it (up to THUMB_WAIT_MAX_MS), and the flex average restarts when it lands.
    const pointing = fx.handThumbsUp(-0.15, 0); // wrist at the neutral pose's right wrist (0.35, 0.8), chest height
    const fist = fx.handThumbsDown().map((q) => ({ x: q.x + 0.22, y: q.y - 0.58 })); // the flexing fist at the flexed pose's left wrist (0.72, 0.22), not a thumbs-up
    const hands = [pointing, fist];
    it("a flex whose other hand reads as a thumbs-up fires Goblin Muscle only, even though the pose lands 400 ms after the hands", () => {
      const e = new GestureEngine();
      const fired: string[] = [];
      for (let t = 0; t < 3000; t += 40) {
        // The stale pose still has both arms hanging; from 400 ms it has the left arm flexed (wrist at the fist).
        const r = e.update({ hands, pose: t < 400 ? fx.poseNeutral() : fx.poseFlex(), aspect: 1 }, t);
        if (r.fired) fired.push(`${r.fired}@${t}`);
      }
      expect(fired).toHaveLength(1);
      expect(fired[0]).toMatch(/^flex@/);
      expect(Number(fired[0].split("@")[1])).toBeLessThanOrEqual(1000);
    });
    it("a flex the pose finds one frame after the hands (no stale pose, just a head start) still fires Goblin Muscle only", () => {
      // Without the wait, the thumbs-up's 150 ms charge beats the ratio rule while the flex average is still climbing.
      const e = new GestureEngine();
      const fired: string[] = [];
      const stalePose = fx.poseFlex();
      stalePose[POSE.LEFT_WRIST] = { x: 0.7, y: 0.3 }; // the pose already places a wrist by the fist (current), but the arm is not yet a flex
      for (let t = 0; t < 3000; t += 40) {
        const r = e.update({ hands, pose: t < 40 ? stalePose : fx.poseFlex(), aspect: 1 }, t);
        if (r.fired) fired.push(r.fired);
      }
      expect(fired).toEqual(["flex"]);
    });
    it("a thumbs-up whose pose never catches up (a wrist the pose cannot place) still fires within the wait cap", () => {
      const e = new GestureEngine();
      const fired: string[] = [];
      const pose = fx.poseNeutral();
      pose[POSE.RIGHT_WRIST] = { x: 0.1, y: 0.95 }; // the pose puts the right wrist nowhere near the hand model's
      for (let t = 0; t < 2000; t += 40) {
        const r = e.update({ hands: [pointing], pose, aspect: 1 }, t);
        if (r.fired) fired.push(`${r.fired}@${t}`);
      }
      expect(fired).toHaveLength(1);
      const at = Number(fired[0].split("@")[1]);
      expect(at).toBeGreaterThanOrEqual(THUMB_WAIT_MAX_MS);
      expect(at).toBeLessThanOrEqual(THUMB_WAIT_MAX_MS + 80);
    });
    it("a thumbs-up without any pose fires after the settle time (THUMB_SETTLE_MS), never the wait cap", () => {
      const e = new GestureEngine();
      const fires = drive(e, thumbFrame, 0, 1000, 40);
      expect(fires).toHaveLength(1);
      expect(fires[0]).toBeLessThanOrEqual(Math.max(ON_MS.thumbs_up, THUMB_SETTLE_MS) + 80);
    });
    it("a thumbs-up whose pose agrees with the hands fires after the settle time, never the wait cap", () => {
      const e = new GestureEngine();
      const fires = drive(e, { hands: [pointing], pose: fx.poseNeutral(), aspect: 1 }, 0, 1000, 40);
      expect(fires).toHaveLength(1);
      expect(fires[0]).toBeLessThanOrEqual(Math.max(ON_MS.thumbs_up, THUMB_SETTLE_MS) + 80);
      expect(fires[0]).toBeLessThan(THUMB_WAIT_MAX_MS);
    });
  });
  it("reports every active gesture, not only the winner", () => {
    const e = new GestureEngine();
    let r = e.update(thumbFrame, 0);
    for (let t = 40; t < 1000; t += 40) r = e.update(thumbFrame, t);
    expect(r.actives).toEqual(["thumbs_up"]);
    expect(r.active).toBe("thumbs_up");
  });
});

describe("GestureEngine time-based dwell / release (D4)", () => {
  it("fires once the score has held for ON_MS, at 25 fps and at 8 fps alike (a thumbs-up also settles for THUMB_SETTLE_MS)", () => {
    for (const [frame, onMs] of [
      [flexFrame, ON_MS.flex],
      [thumbFrame, Math.max(ON_MS.thumbs_up, THUMB_SETTLE_MS)],
    ] as const) {
      for (const dt of [40, 125]) {
        const e = new GestureEngine();
        const fires = drive(e, frame, 0, 2000, dt);
        expect(fires, `dt ${dt}`).toHaveLength(1);
        expect(fires[0]).toBeGreaterThanOrEqual(onMs);
        expect(fires[0]).toBeLessThan(onMs + dt + 1);
      }
    }
  });
  it("a gesture held for ten seconds with short dips fires exactly once", () => {
    const e = new GestureEngine();
    const fires: number[] = [];
    // 1 s on, 200 ms dropped (landmark jitter), repeated for 10 s: the 200 ms dips are shorter than OFF_MS.
    for (let t = 0; t < 10_000; t += 40) {
      const frame = t % 1200 < 1000 ? yawnFrame : empty;
      if (e.update(frame, t).fired) fires.push(t);
    }
    expect(fires).toHaveLength(1);
  });
  it("releases after OFF_MS below the line and needs a full ON_MS to fire again", () => {
    const e = new GestureEngine();
    const first = drive(e, flexFrame, 0, 1000, 40);
    expect(first).toHaveLength(1);
    expect(drive(e, empty, 1000, 1000 + OFF_MS - 80, 40)).toEqual([]);
    expect(e.update(flexFrame, 1000 + OFF_MS - 40, ).active).toBe("flex"); // still active: the dip was too short
    drive(e, empty, 1000 + OFF_MS, 2200, 40); // now a real release
    const second = drive(e, flexFrame, 2200, 3200, 40);
    expect(second).toHaveLength(1);
    expect(second[0] - 2200).toBeGreaterThanOrEqual(ON_MS.flex);
  });
  it("a yawn needs a longer hold than a thumbs-up (talking is short, a yawn is not)", () => {
    expect(ON_MS.yawn).toBeGreaterThan(ON_MS.thumbs_up);
    const e = new GestureEngine();
    expect(drive(e, yawnFrame, 0, ON_MS.yawn - 40, 40)).toEqual([]);
    expect(drive(e, yawnFrame, ON_MS.yawn - 40, ON_MS.yawn + 200, 40)).toHaveLength(1);
  });
  it("a gesture that vanishes from the frame releases like any other miss (OFF_MS after the smoothed score has dropped)", () => {
    const e = new GestureEngine();
    drive(e, yawnFrame, 0, 1000, 40);
    // The smoothed score takes about SMOOTH_MS * ln(1 / OFF_LINE) to fall below the line, then OFF_MS.
    const decay = Math.ceil(SMOOTH_MS * Math.log(1 / OFF_LINE));
    drive(e, empty, 1000, 1000 + decay + OFF_MS + 80, 40);
    expect(e.update(yawnFrame, 1000 + decay + OFF_MS + 80).active).toBeNull();
  });
  it("rides through landmark dropouts: a score that is 0 on every third frame still fires once and holds", () => {
    const e = new GestureEngine();
    const fires: number[] = [];
    let last: ReturnType<GestureEngine["update"]> | null = null;
    for (let t = 0, i = 0; t < 4000; t += 40, i++) {
      last = e.update(i % 3 === 2 ? empty : thumbFrame, t);
      if (last.fired) fires.push(t);
    }
    expect(fires).toHaveLength(1);
    expect(fires[0]).toBeLessThan(600);
    expect(last!.active).toBe("thumbs_up");
  });
  it("picks one winner by score when two gestures are active", () => {
    const e = new GestureEngine();
    const both = { ...thumbFrame, ...yawnFrame };
    let last = e.update(both, 0);
    for (let t = 40; t < 1000; t += 40) last = e.update(both, t);
    expect(last.active).toBe("yawn");
  });
  it("names the weakest cue of the closest gesture as the hint while nothing is active", () => {
    const e = new GestureEngine();
    // A bent, raised arm with the wrist in front of the chest instead of beside the head: only "beside" is missing.
    const pose = fx.poseNeutral();
    pose[13] = { x: 0.8, y: 0.45 };
    pose[15] = { x: 0.55, y: 0.3 };
    const r = e.update({ pose }, 0);
    expect(r.active).toBeNull();
    expect(r.hint).not.toBeNull();
    expect(r.hint!.gesture).toBe("flex");
    expect(r.hint!.cue).toBe("beside");
  });
  it("reset clears state", () => {
    const e = new GestureEngine();
    drive(e, thumbFrame, 0, 1000, 40);
    e.reset();
    expect(e.update(thumbFrame, 1000).active).toBeNull();
  });
});

describe("emotes and the 2 s spam gate", () => {
  it("maps each gesture to one Supercell emote with art and sound", () => {
    expect(EMOTES).toHaveLength(3);
    expect(emoteForGesture("flex").id).toBe("goblin_muscle");
    expect(emoteForGesture("yawn").id).toBe("princess_yawn");
    expect(emoteForGesture("thumbs_up").id).toBe("thumbs_up");
    for (const e of EMOTES) {
      expect(e.image).toMatch(/^\/emotes\/.+\.png$/);
      expect(e.sound).toMatch(/^\/emotes\/.+\.mp3$/);
    }
  });
  it("D2: a different gesture may play GAP_MS after the last one; the same gesture waits COOLDOWN_MS", () => {
    const gate = new EmoteGate();
    const frame = (fired: Gesture | null, actives: Gesture[]) => ({ fired, actives });
    expect(gate.update(frame("thumbs_up", ["thumbs_up"]), 0)?.id).toBe("thumbs_up");
    // A flex edge 300 ms later is too soon (its sound would talk over the thumbs-up), but it is
    // remembered and plays when the gap ends, because the flex is still held.
    expect(gate.update(frame("flex", ["flex"]), 300)).toBeNull();
    expect(gate.update(frame(null, ["flex"]), 500)).toBeNull();
    expect(gate.update(frame(null, ["flex"]), GAP_MS)?.id).toBe("goblin_muscle");
    expect(gate.update(frame(null, ["flex"]), GAP_MS + 40)).toBeNull();
    // The same gesture again (released and re-held) waits the full cooldown from its last fire.
    expect(gate.update(frame("flex", ["flex"]), GAP_MS + 1000)).toBeNull();
    expect(gate.update(frame(null, ["flex"]), GAP_MS + COOLDOWN_MS - 40)).toBeNull();
    expect(gate.update(frame(null, ["flex"]), GAP_MS + COOLDOWN_MS)?.id).toBe("goblin_muscle");
    expect(gate.remaining(GAP_MS + COOLDOWN_MS)).toBe(COOLDOWN_MS);
  });
  it("D2: a refused edge whose gesture is released before the gap ends never plays", () => {
    const gate = new EmoteGate();
    expect(gate.update({ fired: "thumbs_up", actives: ["thumbs_up"] }, 0)?.id).toBe("thumbs_up");
    expect(gate.update({ fired: "yawn", actives: ["yawn"] }, 200)).toBeNull();
    expect(gate.update({ fired: null, actives: [] }, 400)).toBeNull(); // yawn released
    expect(gate.update({ fired: null, actives: [] }, 5000)).toBeNull();
  });
  it("a gesture held through a whole cooldown fires once, not again when the cooldown ends", () => {
    const gate = new EmoteGate();
    expect(gate.update({ fired: "yawn", actives: ["yawn"] }, 0)?.id).toBe("princess_yawn");
    for (let t = 40; t < 6000; t += 40) expect(gate.update({ fired: null, actives: ["yawn"] }, t)).toBeNull();
  });
});
