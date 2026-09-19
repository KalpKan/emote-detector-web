/**
 * Consumer-grade gate on VIDEO-mode landmarks (FIX round 2, docs/reports/emotes.md D1/D2):
 * the site's own .task models run in VIDEO mode over the fake-camera clips, so the pose
 * landmarks jitter frame to frame exactly as they do on the page, where the IMAGE-mode
 * stills (tests/stills.test.ts) are steady. Fixtures: tests/fixtures/video/*.json
 * (scripts/build_e2e_clips.py -> extract_video_landmarks.py -> compact-video-fixture.ts).
 * Judged with the same rules as the clip scripts: every event fires its emote once within
 * 1 s, nothing else fires, a hard-negative reel fires nothing.
 */
import { describe, expect, it } from "vitest";
import { GESTURES } from "../src/gestures/engine";
import { clipMetrics, judgeClip, loadVideoClips, runFrames, type VideoClip } from "./corpus";

const T = 20_000;
const videos = loadVideoClips();
const judged = videos.map((v) => {
  const fires = runFrames(v.frames, v.aspect);
  return { v, j: judgeClip(v.clip, fires), fires: fires.map((f) => `${f.gesture}@${f.ms}`).join(" ") || "none" };
});
const byId = (id: string) => judged.find((x) => x.v.id === id)!;

describe("VIDEO-mode landmark clips (real .task models, jittery pose)", () => {
  it("covers the round-2 reels", () => {
    for (const id of ["tu04x4", "fast", "misses", "flex09x3", "hard", "hard2", "sweep", "tu17x4", "repeat"]) expect(videos.map((v) => v.id), id).toContain(id);
  });

  it("tu04x4 (D1): a thumbs-up beside the head with the elbow bent is Thumbs Up four times, never Goblin Muscle", { timeout: T }, () => {
    const x = byId("tu04x4");
    expect(x.j.problems, `fires: ${x.fires}`).toEqual([]);
    expect(x.j.matched.filter((f) => f.gesture === "thumbs_up").length).toBe(4);
  });

  it("flex09x3: a flexing fist whose thumb reads as a thumbs-up plays exactly one emote per hold, never two", { timeout: T }, () => {
    // At a hard cut the hand model settles a frame before the pose model, so Thumbs Up may be the one that
    // plays (the still corpus holds this photo at flex); a second emote for the same hold is the defect.
    const x = byId("flex09x3");
    expect(x.j.problems, `fires: ${x.fires}`).toEqual([]);
    expect(x.j.matched.length).toBe(3);
  });

  it("fast (D2): thumbs-up 1.2 s -> flex 1.2 s -> yawn 1.5 s back to back fires all three, in order", { timeout: T }, () => {
    const x = byId("fast");
    expect(x.j.problems, `fires: ${x.fires}`).toEqual([]);
    expect(x.j.matched.map((f) => f.gesture)).toEqual(["thumbs_up", "flex", "yawn"]);
  });

  describe("every positive reel fires each event once, within 1 s, and nothing else", () => {
    for (const x of judged.filter((x) => x.v.clip.kind === "positive")) {
      it(x.v.id, { timeout: T }, () => {
        expect(x.j.problems, `fires: ${x.fires}`).toEqual([]);
      });
    }
  });

  describe("hard-negative reels (cover-eyes, dab, screams, a hand over a yawn) fire nothing", () => {
    for (const x of judged.filter((x) => x.v.clip.kind === "hard")) {
      it(x.v.id, { timeout: T }, () => {
        expect(x.fires).toBe("none");
      });
    }
  });

  it("per-gesture precision and recall are 100 % over the VIDEO-mode reels", { timeout: T }, () => {
    const m = clipMetrics(judged.map((x) => ({ clip: x.v.clip, j: x.j })));
    for (const g of GESTURES) {
      expect(m[g].precision, `${g} precision (tp ${m[g].tp} fp ${m[g].fp})`).toBe(1);
      expect(m[g].recall, `${g} recall (tp ${m[g].tp} fn ${m[g].fn})`).toBe(1);
    }
  });
});

export type { VideoClip };
