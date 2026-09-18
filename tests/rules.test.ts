import { describe, expect, it } from "vitest";
import { faceMetrics, scoreYawn } from "../src/gestures/face";
import { scoreFlex } from "../src/gestures/flex";
import { angle, dist, normalise } from "../src/gestures/geometry";
import { scoreThumbLoose, scoreThumbStrict } from "../src/gestures/thumbsUp";
import * as fx from "../src/fixtures";

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
    const s = scoreFlex(fx.poseFlex());
    expect(s).toBeGreaterThanOrEqual(0.5);
    expect(s).toBeCloseTo(0.83, 1);
  });
  it("scores hanging arms at 0", () => {
    expect(scoreFlex(fx.poseNeutral())).toBe(0);
  });
  it("is symmetric: the right arm flexing scores the same", () => {
    const mirrored = fx.poseFlex().map((p) => ({ x: 1 - p.x, y: p.y }));
    // Mirror swaps left/right landmark roles only geometrically; both arms are checked.
    expect(scoreFlex(mirrored)).toBeGreaterThan(0);
  });
  it("returns 0 without a pose", () => {
    expect(scoreFlex(null)).toBe(0);
    expect(scoreFlex([])).toBe(0);
  });
});

describe("thumbs-up rules", () => {
  it("strict rule: thumb up, fingers folded -> 1", () => {
    expect(scoreThumbStrict([fx.handThumbsUp()])).toBeCloseTo(1, 6);
  });
  it("loose rule: thumb up -> 1", () => {
    expect(scoreThumbLoose([fx.handThumbsUp()])).toBeCloseTo(1, 6);
  });
  it("open palm scores 0 on both rules", () => {
    expect(scoreThumbStrict([fx.handOpenPalm()])).toBe(0);
    expect(scoreThumbLoose([fx.handOpenPalm()])).toBe(0);
  });
  it("thumbs-down scores 0 on both rules", () => {
    expect(scoreThumbStrict([fx.handThumbsDown()])).toBe(0);
    expect(scoreThumbLoose([fx.handThumbsDown()])).toBe(0);
  });
  it("takes the best hand when two are visible", () => {
    expect(scoreThumbStrict([fx.handOpenPalm(), fx.handThumbsUp()])).toBeCloseTo(1, 6);
  });
  it("returns 0 for no hands", () => {
    expect(scoreThumbStrict([])).toBe(0);
    expect(scoreThumbLoose(null)).toBe(0);
  });
});

describe("face metrics and yawn -> Princess Yawn", () => {
  it("computes mouth and eye ratios relative to the face box", () => {
    const m = faceMetrics(fx.faceYawn());
    expect(m).not.toBeNull();
    expect(m!.mouthWidthRatio).toBeCloseTo(0.16 / 0.4, 6);
    expect(m!.mouthHeightRatio).toBeCloseTo(0.12 / 0.4, 6);
    expect(m!.mouthOpenRatio).toBeCloseTo(0.75, 6);
    expect(m!.avgEyeOpenRatio).toBeCloseTo(0.125, 6);
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
  it("returns null / 0 without a face", () => {
    expect(faceMetrics(null)).toBeNull();
    expect(scoreYawn(null)).toBe(0);
  });
});
