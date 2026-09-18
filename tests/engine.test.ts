import { describe, expect, it } from "vitest";
import { EmoteGate, EMOTES, emoteForGesture } from "../src/emotes";
import { faceMetrics } from "../src/gestures/face";
import { fuseScores, GestureEngine } from "../src/gestures/engine";
import * as fx from "../src/fixtures";

const thumbFrame = { hands: [fx.handThumbsUp()] };
const flexFrame = { pose: fx.poseFlex() };
const yawnFrame = { face: faceMetrics(fx.faceYawn()) };
const empty = {};

describe("fuseScores (BehaviorAnalyzer.analyze conflict rules)", () => {
  it("scores each gesture from its own input", () => {
    expect(fuseScores(thumbFrame).thumbs_up).toBeGreaterThanOrEqual(0.6);
    expect(fuseScores(flexFrame).flex).toBeGreaterThanOrEqual(0.5);
    expect(fuseScores(yawnFrame).yawn).toBeGreaterThanOrEqual(0.5);
    expect(fuseScores(empty)).toEqual({ flex: 0, thumbs_up: 0, yawn: 0 });
  });
  it("a strong yawn suppresses thumbs-up and flex", () => {
    const s = fuseScores({ ...thumbFrame, ...flexFrame, ...yawnFrame });
    expect(s.yawn).toBeGreaterThanOrEqual(0.6);
    expect(s.thumbs_up).toBe(0);
    expect(s.flex).toBe(0);
  });
  it("a flexing arm (>= 0.4) drops a thumbs-up", () => {
    const s = fuseScores({ ...thumbFrame, ...flexFrame });
    expect(s.flex).toBeGreaterThan(0);
    expect(s.thumbs_up).toBe(0);
  });
  it("flex needs a pose; a hand alone never flexes", () => {
    expect(fuseScores({ hands: [fx.handThumbsUp()] }).flex).toBe(0);
  });
  it("a face with open eyes cannot yawn", () => {
    expect(fuseScores({ face: faceMetrics(fx.faceOpenMouthEyesOpen()) }).yawn).toBe(0);
  });
});

describe("GestureEngine dwell / cool-down FSM", () => {
  it("activates on the 3rd consecutive frame and fires exactly once", () => {
    const e = new GestureEngine();
    expect(e.update(thumbFrame).active).toBeNull();
    expect(e.update(thumbFrame).active).toBeNull();
    const third = e.update(thumbFrame);
    expect(third.active).toBe("thumbs_up");
    expect(third.fired).toBe("thumbs_up");
    const fourth = e.update(thumbFrame);
    expect(fourth.active).toBe("thumbs_up");
    expect(fourth.fired).toBeNull();
  });
  it("stays active through 2 missed frames, drops on the 3rd, needs a full dwell to re-fire", () => {
    const e = new GestureEngine();
    for (let i = 0; i < 3; i++) e.update(flexFrame);
    expect(e.update(empty).active).toBe("flex");
    expect(e.update(empty).active).toBe("flex");
    expect(e.update(empty).active).toBeNull();
    expect(e.update(flexFrame).fired).toBeNull();
    expect(e.update(flexFrame).fired).toBeNull();
    expect(e.update(flexFrame).fired).toBe("flex");
  });
  it("a gesture that vanishes counts as a miss (fix over the Python FSM)", () => {
    const e = new GestureEngine();
    for (let i = 0; i < 3; i++) e.update(yawnFrame);
    for (let i = 0; i < 3; i++) e.update(empty);
    expect(e.update(yawnFrame).active).toBeNull();
  });
  it("picks one winner by score when two gestures are active", () => {
    const e = new GestureEngine();
    const both = { ...thumbFrame, ...yawnFrame };
    let last = e.update(both);
    for (let i = 0; i < 2; i++) last = e.update(both);
    expect(last.active).toBe("yawn");
  });
  it("respects custom dwell and cooldown", () => {
    const e = new GestureEngine({ dwell: { thumbs_up: 1 }, cooldownFrames: 1 });
    expect(e.update(thumbFrame).fired).toBe("thumbs_up");
    expect(e.update(empty).active).toBeNull();
  });
  it("reset clears state", () => {
    const e = new GestureEngine();
    for (let i = 0; i < 3; i++) e.update(thumbFrame);
    e.reset();
    expect(e.update(thumbFrame).active).toBeNull();
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
