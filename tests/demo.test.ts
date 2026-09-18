import { describe, expect, it } from "vitest";
import { DemoSource } from "../src/demo";
import { EmoteGate } from "../src/emotes";
import { faceMetrics } from "../src/gestures/face";
import { GestureEngine } from "../src/gestures/engine";

/**
 * Runs the demo replay through the same engine + gate the page uses, at the
 * page's fixed 40 ms step, and checks that one loop fires the three emotes in
 * the demo's order and nothing else. This is the headless twin of "Play demo".
 */
describe("demo replay end to end", () => {
  it("fires Thumbs Up, Goblin Muscle, Princess Yawn once each per loop", () => {
    const demo = new DemoSource();
    const engine = new GestureEngine();
    const gate = new EmoteGate();
    const step = 0.04;
    const frames = Math.ceil(demo.loopSeconds / step);
    const fired: string[] = [];
    for (let i = 1; i <= frames; i++) {
      const t = i * step;
      const f = demo.frame(t);
      const r = engine.update({ pose: f.pose, hands: f.hands, face: faceMetrics(f.face, 640 / 480) });
      if (r.fired) {
        const e = gate.tryFire(r.fired, t * 1000);
        if (e) fired.push(e.id);
      }
    }
    expect(fired).toEqual(["thumbs_up", "goblin_muscle", "princess_yawn"]);
  });

  it("loops: the second pass fires the same three again", () => {
    const demo = new DemoSource();
    const engine = new GestureEngine();
    const gate = new EmoteGate();
    const step = 0.04;
    const frames = Math.ceil((demo.loopSeconds * 2) / step);
    let count = 0;
    for (let i = 1; i <= frames; i++) {
      const f = demo.frame(i * step);
      const r = engine.update({ pose: f.pose, hands: f.hands, face: faceMetrics(f.face, 640 / 480) });
      if (r.fired && gate.tryFire(r.fired, i * step * 1000)) count++;
    }
    expect(count).toBe(6);
  });
});
