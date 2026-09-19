import { describe, expect, it } from "vitest";
import { faceMetrics, scoreYawn, scoreYawnDetailed } from "../src/gestures/face";
import { scoreFlex, scoreFlexDetailed } from "../src/gestures/flex";
import { angle, dist, normalise } from "../src/gestures/geometry";
import { scoreThumbsUp, scoreThumbsUpDetailed } from "../src/gestures/thumbsUp";
import * as fx from "../src/fixtures";
import { loadStills, type Still } from "./corpus";

const stills = new Map(loadStills().map((s) => [s.id, s]));
const still = (id: string): Still => {
  const s = stills.get(id);
  if (!s) throw new Error(`no still ${id}`);
  return s;
};
const metricsOf = (s: Still) => faceMetrics(s.face, s.aspect);

describe("geometry (ports of the Python helpers)", () => {
  it("normalise clamps into [0, 1] and returns 0 for a degenerate range", () => {
    expect(normalise(0.5, 0, 1)).toBe(0.5);
    expect(normalise(-1, 0, 1)).toBe(0);
    expect(normalise(9, 0, 1)).toBe(1);
    expect(normalise(0.5, 1, 1)).toBe(0);
    expect(normalise(Number.NaN, 0, 1)).toBe(0);
  });
  it("angle at the vertex in degrees, null when a point coincides with the vertex", () => {
    expect(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 6);
    expect(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(180, 6);
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("flex -> Goblin Muscle", () => {
  it("scores a bent, raised arm beside the head above the 0.5 activation line", () => {
    expect(scoreFlex(fx.poseFlex())).toBeGreaterThanOrEqual(0.5);
  });
  it("scores hanging arms at 0", () => {
    expect(scoreFlex(fx.poseNeutral())).toBe(0);
  });
  it("is symmetric: the mirrored pose scores the same", () => {
    const mirrored = fx.poseFlex().map((p) => ({ x: 1 - p.x, y: p.y }));
    expect(scoreFlex(mirrored)).toBeCloseTo(scoreFlex(fx.poseFlex()), 6);
  });
  it("returns 0 without a pose", () => {
    expect(scoreFlex(null)).toBe(0);
    expect(scoreFlex([])).toBe(0);
  });
  it("names its cues: bend, height, beside, level, clear", () => {
    const r = scoreFlexDetailed(fx.poseFlex(), { aspect: 1 });
    expect(Object.keys(r.cues).sort()).toEqual(["bend", "beside", "clear", "height", "level"]);
    for (const v of Object.values(r.cues)) expect(v).toBeGreaterThanOrEqual(0.5);
  });
  it("real photo: a clean flex (flex-14) scores >= 0.5", () => {
    const s = still("flex-14");
    expect(scoreFlex(s.pose, { aspect: s.aspect, face: metricsOf(s) })).toBeGreaterThanOrEqual(0.5);
  });
  it("real photo: hands over the eyes (cover_eyes-02) is not a flex: the wrist is inside the shoulder line", () => {
    const s = still("cover_eyes-02");
    const r = scoreFlexDetailed(s.pose!, { aspect: s.aspect, face: metricsOf(s) });
    expect(r.score).toBeLessThan(0.5);
    expect(r.cues.beside).toBeLessThan(0.5);
  });
  it("real photo: a dab (dab-01) is not a flex", () => {
    const s = still("dab-01");
    expect(scoreFlex(s.pose, { aspect: s.aspect, face: metricsOf(s) })).toBeLessThan(0.5);
  });
  it("real photo: a thumb up beside the head (thumbs_up-04) is not a flex: the wrist is too low", () => {
    const s = still("thumbs_up-04");
    expect(scoreFlex(s.pose, { aspect: s.aspect, face: metricsOf(s) })).toBeLessThan(0.5);
  });
});

describe("thumbs-up rules", () => {
  it("synthetic hand: thumb up, fingers folded -> >= 0.5", () => {
    expect(scoreThumbsUp([fx.handThumbsUp()])).toBeGreaterThanOrEqual(0.5);
  });
  it("open palm scores 0", () => {
    expect(scoreThumbsUp([fx.handOpenPalm()])).toBe(0);
  });
  it("thumbs-down scores 0", () => {
    expect(scoreThumbsUp([fx.handThumbsDown()])).toBe(0);
  });
  it("takes the best hand when two are visible", () => {
    expect(scoreThumbsUp([fx.handOpenPalm(), fx.handThumbsUp()])).toBeGreaterThanOrEqual(0.5);
  });
  it("returns 0 for no hands", () => {
    expect(scoreThumbsUp([])).toBe(0);
    expect(scoreThumbsUp(null)).toBe(0);
  });
  it("names its cues: folded, up, upright, clear", () => {
    const r = scoreThumbsUpDetailed([fx.handThumbsUp()], { aspect: 1 });
    expect(Object.keys(r.cues).sort()).toEqual(["clear", "folded", "up", "upright"]);
  });
  it("real photo: a real fist with the thumb up (thumbs_up-06, tips level with the knuckles) scores >= 0.5", () => {
    const s = still("thumbs_up-06");
    expect(scoreThumbsUp(s.hands, { aspect: s.aspect, face: metricsOf(s) })).toBeGreaterThanOrEqual(0.5);
  });
  it("real photo: a hand over the mouth (yawn-08, open hand, thumb pointing up) scores 0", () => {
    const s = still("yawn-08");
    const r = scoreThumbsUpDetailed(s.hands, { aspect: s.aspect, face: metricsOf(s) });
    expect(r.score).toBe(0);
    expect(r.cues.folded).toBeLessThan(0.5);
  });
  it("real photo: clenched hands at chest height (angry-07) score 0", () => {
    const s = still("angry-07");
    expect(scoreThumbsUp(s.hands, { aspect: s.aspect, face: metricsOf(s) })).toBe(0);
  });
});

describe("face metrics and yawn -> Princess Yawn", () => {
  it("computes mouth and eye ratios relative to the face box", () => {
    const m = faceMetrics(fx.faceYawn());
    expect(m).not.toBeNull();
    expect(m!.mouthWidthRatio).toBeCloseTo(0.14 / 0.4, 6);
    expect(m!.mouthHeightRatio).toBeCloseTo(0.12 / 0.4, 6);
    expect(m!.mouthOpenRatio).toBeCloseTo(0.12 / 0.14, 6);
    expect(m!.avgEyeOpenRatio).toBeCloseTo(0.05, 6);
    expect(m!.box).toEqual({ x0: 0.3, y0: 0.1, x1: 0.7, y1: 0.5 });
  });
  it("scales x by the frame aspect so ratios are geometric", () => {
    const wide = faceMetrics(fx.faceYawn(), 16 / 9)!;
    const square = faceMetrics(fx.faceYawn(), 1)!;
    expect(wide.mouthOpenRatio).toBeLessThan(square.mouthOpenRatio);
    expect(wide.mouthWidthRatio).toBeCloseTo(square.mouthWidthRatio, 6);
  });
  it("wide mouth + narrowed eyes scores a yawn", () => {
    expect(scoreYawn(faceMetrics(fx.faceYawn()))).toBeGreaterThanOrEqual(0.5);
  });
  it("open mouth with open eyes is not a yawn", () => {
    expect(scoreYawn(faceMetrics(fx.faceOpenMouthEyesOpen()))).toBe(0);
  });
  it("closed mouth is not a yawn", () => {
    expect(scoreYawn(faceMetrics(fx.face()))).toBe(0);
  });
  it("names its cues: mouth, eyes", () => {
    expect(Object.keys(scoreYawnDetailed(faceMetrics(fx.faceYawn())).cues).sort()).toEqual(["brows", "eyes", "mouth"]);
  });
  it("returns null / 0 without a face", () => {
    expect(faceMetrics(null)).toBeNull();
    expect(scoreYawn(null)).toBe(0);
  });
  it("real photo: a moderate yawn with the eyes shut (yawn-17) scores >= 0.5", () => {
    expect(scoreYawn(metricsOf(still("yawn-17")))).toBeGreaterThanOrEqual(0.5);
  });
  it("real photo: a scream with the eyes open (angry-05) scores 0", () => {
    expect(scoreYawn(metricsOf(still("angry-05")))).toBe(0);
  });
  it("real photo: a scream with the eyes shut (angry-01) stays under the line: the brows are knitted down", () => {
    const r = scoreYawnDetailed(metricsOf(still("angry-01")));
    expect(r.score).toBeLessThan(0.5);
    expect(r.cues.brows).toBeLessThan(0.5);
  });
  it("real photo: a yawn lying sideways (yawn-07) still scores: every gap is measured along the face", () => {
    expect(scoreYawn(metricsOf(still("yawn-07")))).toBeGreaterThanOrEqual(0.5);
  });
});
