/**
 * Consumer-grade gate on the ground-truth clips (docs/reports/emotes-spec.md §3, S2-S6, emote level):
 * every gesture fires once, the right emote, within 1 s of being reached; a
 * neutral minute fires nothing; the hard-negative minute fires at most once.
 * Clip scripts: tests/fixtures/clips/clips.json (scripts/build_clip_scripts.py).
 * Report: npx vite-node scripts/eval-corpus.ts
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { clipMetrics, GESTURES, judgeClip, loadClips, loadStills, runClip, synthesizeClip, type Clip, type Judgement } from "./corpus";

const T = 20_000;
const stills = loadStills();
const clips = loadClips();
const judged: Array<{ clip: Clip; j: Judgement; fires: string }> = clips.map((clip) => {
  const frames = synthesizeClip(clip, stills);
  const { fires } = runClip(clip, frames);
  return { clip, j: judgeClip(clip, fires), fires: fires.map((f) => `${f.gesture}@${f.ms}`).join(" ") || "none" };
});
const byId = (id: string) => judged.find((x) => x.clip.id === id)!;

describe("ground-truth clips (25 fps landmark sequences)", () => {
  it("synthesis is deterministic (same frames every run)", { timeout: T }, () => {
    const c = clips.find((x) => x.id === "sequence-three")!;
    const h = (frames: unknown) => createHash("sha256").update(JSON.stringify(frames)).digest("hex");
    expect(h(synthesizeClip(c, stills))).toBe(h(synthesizeClip(c, stills)));
    expect(clips.length).toBe(58);
  });

  describe("each clear gesture fires its emote exactly once, within 1 s", () => {
    for (const x of judged.filter((x) => x.clip.kind === "positive")) {
      it(x.clip.id, { timeout: T }, () => {
        expect(x.j.problems, `fires: ${x.fires}. ${x.clip.note}`).toEqual([]);
      });
    }
  });

  describe("a yawn behind a hand, or a gesture the landmarkers cannot see, never fires a different emote", () => {
    for (const x of judged.filter((x) => x.clip.kind === "occluded" || x.clip.kind === "partial")) {
      it(x.clip.id, { timeout: T }, () => {
        expect(x.j.problems, `fires: ${x.fires}. ${x.clip.note}`).toEqual([]);
      });
    }
  });

  it("neutral-60s: a person at rest, talking and looking around fires nothing (< 1 false trigger per minute)", { timeout: T }, () => {
    const x = byId("neutral-60s");
    expect(x.j.unmatched.map((f) => `${f.gesture}@${f.ms}`), x.clip.note).toEqual([]);
  });

  it("hard-negatives-60s: cover-eyes, dab and screams fire at most once in the minute", { timeout: T }, () => {
    const x = byId("hard-negatives-60s");
    expect(x.j.unmatched.length, `fires: ${x.fires}`).toBeLessThanOrEqual(1);
  });

  it("per-gesture emote precision >= 95% and recall >= 90% over the whole clip set", { timeout: T }, () => {
    const m = clipMetrics(judged);
    for (const g of GESTURES) {
      expect(m[g].precision, `${g} precision (tp ${m[g].tp} fp ${m[g].fp})`).toBeGreaterThanOrEqual(0.95);
      expect(m[g].recall, `${g} recall (tp ${m[g].tp} fn ${m[g].fn})`).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("fires land within 1000 ms of the gesture being reached (p95) and are never late by more than 1000 ms", { timeout: T }, () => {
    const lat = judged.flatMap((x) => x.j.latenciesMs).sort((a, b) => a - b);
    expect(lat.length).toBeGreaterThan(0);
    expect(lat[lat.length - 1]).toBeLessThanOrEqual(1000);
  });
});
