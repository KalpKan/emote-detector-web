/**
 * Turns a full VIDEO-mode landmark dump (scripts/extract_video_landmarks.py)
 * into a committed fixture under tests/fixtures/video/: pose and hand landmarks
 * as they are, and the 478-point face reduced to the FaceMetrics the engine
 * consumes (src/gestures/face.ts `faceMetrics`), which is 50x smaller. If
 * `faceMetrics` ever changes what it measures, rebuild the fixtures from the
 * clips (scripts/build_e2e_clips.py + extract_video_landmarks.py).
 *
 *   npx vite-node scripts/compact-video-fixture.ts IN.json tests/fixtures/video/<name>.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { faceMetrics } from "../src/gestures/face";
import type { Pt } from "../src/gestures/geometry";

const [, , input, output] = process.argv;
if (!input || !output) throw new Error("usage: compact-video-fixture.ts IN.json OUT.json");
const d = JSON.parse(readFileSync(input, "utf8"));
const toPts = (a: number[][]): Pt[] => a.map(([x, y]) => ({ x, y }));
const r4 = (n: number): number => Math.round(n * 10000) / 10000;
const round = (a: number[][]): number[][] => a.map(([x, y]) => [r4(x), r4(y)]);
const frames = d.frames.map((f: { ms: number; pose: number[][] | null; hands: number[][][]; face: number[][] | null }) => {
  const m = faceMetrics(f.face ? toPts(f.face) : null, d.aspect);
  return {
    ms: f.ms,
    pose: f.pose ? round(f.pose) : null,
    hands: f.hands.map(round),
    face: m
      ? {
          mouthWidthRatio: r4(m.mouthWidthRatio),
          mouthHeightRatio: r4(m.mouthHeightRatio),
          mouthOpenRatio: r4(m.mouthOpenRatio),
          leftEyeOpenRatio: r4(m.leftEyeOpenRatio),
          rightEyeOpenRatio: r4(m.rightEyeOpenRatio),
          avgEyeOpenRatio: r4(m.avgEyeOpenRatio),
          browLiftRatio: r4(m.browLiftRatio),
          box: { x0: r4(m.box.x0), y0: r4(m.box.y0), x1: r4(m.box.x1), y1: r4(m.box.y1) },
        }
      : null,
  };
});
const out = {
  _about: `VIDEO-mode landmarks from the site's own .task models over ${d.clip} (scripts/build_e2e_clips.py, git-ignored stock photos), sampled at ${d.fps} fps by scripts/extract_video_landmarks.py and reduced by scripts/compact-video-fixture.ts (face = faceMetrics). Ground truth: events, in the e2e-labels.json format.`,
  clip: d.clip,
  fps: d.fps,
  aspect: r4(d.aspect),
  durationMs: d.durationMs,
  segments: d.segments,
  events: d.events,
  frames,
};
writeFileSync(output, JSON.stringify(out));
console.log(`${basename(output)}: ${frames.length} frames, ${(Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(0)} KB`);
