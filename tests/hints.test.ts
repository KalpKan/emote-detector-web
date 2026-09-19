import { describe, expect, it } from "vitest";
import { GESTURES } from "../src/gestures/engine";
import { HINT_HOLD_MS, HintHold, hintText, stageAspect } from "../src/hints";
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

describe("hint hold (round 2, D3): the shown hint never flickers between gestures", () => {
  const flex = { gesture: "flex" as const, cue: "height", score: 0.7 };
  const thumb = { gesture: "thumbs_up" as const, cue: "folded", score: 0.8 };
  it("keeps a hint for HINT_HOLD_MS even when a different gesture's hint arrives every frame", () => {
    const hold = new HintHold();
    const changes: Array<{ at: number; text: string | null }> = [];
    for (let t = 0; t < 3000; t += 80) {
      const next = (t / 80) % 2 === 0 ? flex : thumb; // alternating at 12.5 Hz, like the D1 jitter
      const shown = hold.update(next, null, t);
      const text = shown ? `${shown.gesture}:${shown.cue}` : null;
      if (!changes.length || changes[changes.length - 1].text !== text) changes.push({ at: t, text });
    }
    for (let i = 1; i < changes.length; i++) expect(changes[i].at - changes[i - 1].at, JSON.stringify(changes)).toBeGreaterThanOrEqual(HINT_HOLD_MS);
    expect(changes[0].text).toBe("flex:height");
  });
  it("clears the hint the moment a gesture becomes active, and shows nothing while one is active", () => {
    const hold = new HintHold();
    expect(hold.update(flex, null, 0)?.gesture).toBe("flex");
    expect(hold.update(null, "flex", 100)).toBeNull();
    expect(hold.update(null, "flex", 200)).toBeNull();
  });
  it("keeps the hint while it briefly disappears (one jittery frame), then lets it go", () => {
    const hold = new HintHold();
    expect(hold.update(thumb, null, 0)?.gesture).toBe("thumbs_up");
    expect(hold.update(null, null, 100)?.gesture).toBe("thumbs_up");
    expect(hold.update(null, null, HINT_HOLD_MS + 1)).toBeNull();
  });
  it("reset forgets the shown hint", () => {
    const hold = new HintHold();
    hold.update(thumb, null, 0);
    hold.reset();
    expect(hold.update(flex, null, 10)?.gesture).toBe("flex");
  });
});
