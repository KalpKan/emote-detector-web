/**
 * Prints the detection report for docs/reports/emotes-spec.md §6: per-gesture
 * precision / recall on the labelled stills (frame level) and on the clips
 * (emote level, with latency), plus the false-trigger rate on the neutral and
 * hard-negative minutes.  Run: npx vite-node scripts/eval-corpus.ts [--verbose]
 */
import { clipMetrics, judgeClip, loadClips, loadStills, metrics, runClip, scoreStill, synthesizeClip, GESTURES, type Judgement, type Clip } from "../tests/corpus";

const verbose = process.argv.includes("--verbose");
const pct = (n: number) => `${Math.round(n * 100)}%`;

// Stills (frame level, engine threshold 0.5)
const stills = loadStills().filter((s) => s.kind !== "skip");
const stillRows = stills.map((s) => {
  const scores = scoreStill(s);
  return { ...s, scores, fired: GESTURES.filter((g) => scores[g] >= 0.5) };
});
if (verbose) {
  for (const r of stillRows) {
    const sc = GESTURES.map((g) => `${g}=${r.scores[g].toFixed(2)}`).join(" ");
    console.log(`${r.id.padEnd(14)} ${r.kind.padEnd(8)} exp=${String(r.expected).padEnd(9)} ${sc} fired=${r.fired.join(",") || "-"}`);
  }
  console.log("");
}
console.log("STILLS (frame level, 94 photos; gated set = ok + neutral + hard)");
const gated = stillRows.filter((r) => r.kind === "ok" || r.kind === "neutral" || r.kind === "hard");
const m = metrics(gated);
for (const g of GESTURES) console.log(`  ${g.padEnd(10)} precision ${pct(m[g].precision)}  recall ${pct(m[g].recall)}  (tp ${m[g].tp} fp ${m[g].fp} fn ${m[g].fn})`);
const neutralFired = stillRows.filter((r) => r.kind === "neutral" && r.fired.length).length;
const hardFired = stillRows.filter((r) => r.kind === "hard" && r.fired.length).length;
const occWrong = stillRows.filter((r) => r.kind === "occluded" && r.fired.some((g) => g !== "yawn")).length;
const occHit = stillRows.filter((r) => r.kind === "occluded" && r.fired.includes("yawn")).length;
console.log(`  neutral stills that fired: ${neutralFired}/${stillRows.filter((r) => r.kind === "neutral").length}   hard negatives that fired: ${hardFired}/${stillRows.filter((r) => r.kind === "hard").length}`);
console.log(`  occluded yawns: ${occHit}/8 detected, ${occWrong} fired a wrong emote   partial stills (gesture not visible): ${stillRows.filter((r) => r.kind === "partial" && r.expected && r.fired.includes(r.expected)).length}/5 detected, ${stillRows.filter((r) => r.kind === "partial" && r.fired.some((g) => g !== r.expected)).length} fired a wrong emote`);

// Clips (emote level)
console.log("\nCLIPS (emote level, 25 fps synthesized from the stills; fire window 1000 ms)");
const clips = loadClips();
const judged: Array<{ clip: Clip; j: Judgement }> = [];
let pass = 0;
let total = 0;
const latencies: number[] = [];
for (const c of clips) {
  const frames = synthesizeClip(c);
  const { fires } = runClip(c, frames);
  const j = judgeClip(c, fires);
  latencies.push(...j.latenciesMs);
  judged.push({ clip: c, j });
  if (c.kind === "neutral" || c.kind === "hard") {
    const secs = frames[frames.length - 1].ms / 1000;
    console.log(`  ${c.id.padEnd(22)} ${fires.length} firings in ${secs.toFixed(0)} s (${(fires.length / (secs / 60)).toFixed(1)} per minute): ${fires.map((f) => `${f.gesture}@${f.ms}`).join(" ") || "none"}`);
  } else if (verbose || !j.pass) {
    console.log(`  ${c.id.padEnd(22)} ${c.kind.padEnd(8)} ${j.pass ? "PASS" : "FAIL"} fires=[${fires.map((f) => `${f.gesture}@${f.ms}`).join(" ")}] ${j.problems.join("; ")}`);
  }
  total += 1;
  if (j.pass) pass += 1;
}
const cm = clipMetrics(judged);
console.log("");
for (const g of GESTURES) console.log(`  ${g.padEnd(10)} precision ${pct(cm[g].precision)}  recall ${pct(cm[g].recall)}  (tp ${cm[g].tp} fp ${cm[g].fp} fn ${cm[g].fn})`);
latencies.sort((a, b) => a - b);
const p = (q: number) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))] ?? NaN;
console.log(`  latency from onset: median ${p(0.5)} ms, p95 ${p(0.95)} ms, max ${latencies[latencies.length - 1]} ms (${latencies.length} matched fires)`);
console.log(`  gated clips passing: ${pass}/${total}`);
