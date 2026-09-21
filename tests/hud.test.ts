import { describe, expect, it } from "vitest";
import { BEAM_HIGH, BEAM_LOW, beamGesture } from "../src/hud";

const s = (flex: number, thumbs_up: number, yawn: number) => ({ flex, thumbs_up, yawn });

describe("beamGesture (beam-glow-states: one beam per viewport, on a real score)", () => {
  it("is null when nothing is close", () => {
    expect(beamGesture(s(0.1, 0.2, 0), null)).toBeNull();
  });

  it("is null when a score is already over the firing threshold", () => {
    expect(beamGesture(s(0.72, 0.1, 0), null)).toBeNull();
  });

  it("picks the gesture inside the almost-there band", () => {
    expect(beamGesture(s(0.42, 0.1, 0), null)).toBe("flex");
  });

  it("picks only the leading one when two are in the band", () => {
    expect(beamGesture(s(0.38, 0.47, 0), null)).toBe("thumbs_up");
  });

  it("goes quiet while a gesture is active: the emote is the feedback then", () => {
    expect(beamGesture(s(0.42, 0.1, 0), "flex")).toBeNull();
    expect(beamGesture(s(0.42, 0.1, 0), "yawn")).toBeNull();
  });

  it("uses the band the spec names, exclusive at both ends", () => {
    expect(BEAM_LOW).toBe(0.35);
    expect(BEAM_HIGH).toBe(0.5);
    expect(beamGesture(s(BEAM_LOW, 0, 0), null)).toBeNull();
    expect(beamGesture(s(BEAM_HIGH, 0, 0), null)).toBeNull();
  });
});
