import { describe, expect, it } from "vitest";
import { GESTURES } from "../src/gestures/engine";
import { hintText, stageAspect } from "../src/hints";
import * as fx from "../src/fixtures";
import { fuseScores } from "../src/gestures/engine";

describe("cue hints (S7)", () => {
  it("has one plain-English line for every cue every rule can report", () => {
    const { cues } = fuseScores({ pose: fx.poseFlex(), hands: [fx.handThumbsUp()], face: null });
    for (const g of GESTURES) {
      for (const cue of Object.keys(cues[g])) {
        const text = hintText(g, cue);
        expect(text, `${g}.${cue}`).toMatch(/^[A-Z].{10,}/);
        expect(text).not.toMatch(/frame/i);
      }
    }
    for (const cue of ["mouth", "eyes", "brows"]) expect(hintText("yawn", cue)).toMatch(/^[A-Z].{10,}/);
  });
  it("falls back to the gesture's own description for an unknown cue", () => {
    expect(hintText("flex", "nonsense")).toMatch(/fist/i);
  });
});

describe("stage aspect (S8, D6)", () => {
  it("takes the stream's own aspect so a portrait phone stream is not cropped", () => {
    expect(stageAspect(480, 640)).toBe("480 / 640");
    expect(stageAspect(640, 480)).toBe("640 / 480");
  });
  it("falls back to 4:3 without a stream", () => {
    expect(stageAspect(0, 0)).toBe("4 / 3");
  });
});
