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
    for (const id of ["tu04x4", "fast", "misses", "flex09x3", "hard", "hard2", "sweep", "tu17x4", "repeat", "tu04x4-30fps", "flex09x3-30fps"]) expect(videos.map((v) => v.id), id).toContain(id);
  });

  it("tu04x4 (D1): a thumbs-up beside the head with the elbow bent is Thumbs Up four times, never Goblin Muscle", { timeout: T }, () => {
    const x = byId("tu04x4");
    expect(x.j.problems, `fires: ${x.fires}`).toEqual([]);
    expect(x.j.matched.filter((f) => f.gesture === "thumbs_up").length).toBe(4);
  });

  it("flex09x3 (round-3 D1): a flex whose other hand reads as a thumbs-up plays Goblin Muscle three times, never Thumbs Up", { timeout: T }, () => {
    // flex-09: one arm flexed, the other hand pointing at the bicep at chest height, which the hand model calls a
    // perfect thumbs-up from the first frame while the pose model needs ~400 ms after the cut to see the arm.
    // The visitor must see Goblin Muscle, and only that (FIX round 2 accepted Thumbs Up here; that is the defect).
    const x = byId("flex09x3");
    expect(x.j.problems, `fires: ${x.fires}`).toEqual([]);
    expect(x.j.matched.map((f) => f.gesture)).toEqual(["flex", "flex", "flex"]);
    expect(x.fires).not.toContain("thumbs_up");
  });

  it("tu04x4 at the full 30 fps (round 3): still Thumbs Up four times, never Goblin Muscle", { timeout: T }, () => {
    // The 10 fps sample hides how often the jittery half-flex reads >= 0.9 on consecutive frames: a flex-average
    // restart keyed on that step passed the 10 fps reel and fired Goblin Muscle on the real pipeline (and here).
    const x = byId("tu04x4-30fps");
    expect(x.j.problems, `fires: ${x.fires}`).toEqual([]);
    expect(x.j.matched.filter((f) => f.gesture === "thumbs_up").length).toBe(4);
    expect(x.fires).not.toContain("flex");
  });
  it("flex09x3 at the full 30 fps (round 3): Goblin Muscle three times, never Thumbs Up", { timeout: T }, () => {
    const x = byId("flex09x3-30fps");
    expect(x.j.problems, `fires: ${x.fires}`).toEqual([]);
    expect(x.j.matched.map((f) => f.gesture)).toEqual(["flex", "flex", "flex"]);
    expect(x.fires).not.toContain("thumbs_up");
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
