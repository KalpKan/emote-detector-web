import { describe, expect, it } from "vitest";
import { EmoteGate, EMOTES, emoteForGesture } from "../src/emotes";
import { faceMetrics } from "../src/gestures/face";
import { fuseScores, GestureEngine, OFF_MS, ON_MS } from "../src/gestures/engine";
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

describe("GestureEngine time-based dwell / release (D4)", () => {
  it("fires once the score has held for ON_MS, at 25 fps and at 8 fps alike", () => {
    for (const dt of [40, 125]) {
      const e = new GestureEngine();
      const fires = drive(e, thumbFrame, 0, 2000, dt);
      expect(fires, `dt ${dt}`).toHaveLength(1);
      expect(fires[0]).toBeGreaterThanOrEqual(ON_MS.thumbs_up);
      expect(fires[0]).toBeLessThan(ON_MS.thumbs_up + dt + 1);
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
  it("a gesture that vanishes from the frame releases like any other miss", () => {
    const e = new GestureEngine();
    drive(e, yawnFrame, 0, 1000, 40);
    drive(e, empty, 1000, 1000 + OFF_MS + 80, 40);
    expect(e.update(yawnFrame, 1000 + OFF_MS + 80).active).toBeNull();
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
  it("fires, then refuses for 2000 ms, then fires again", () => {
    const gate = new EmoteGate();
    expect(gate.tryFire("thumbs_up", 0)?.id).toBe("thumbs_up");
    expect(gate.tryFire("flex", 1000)).toBeNull();
    expect(gate.tryFire("flex", 1999)).toBeNull();
    expect(gate.remaining(1500)).toBe(500);
    expect(gate.tryFire("flex", 2000)?.id).toBe("goblin_muscle");
    expect(gate.remaining(2000)).toBe(2000);
  });
});
