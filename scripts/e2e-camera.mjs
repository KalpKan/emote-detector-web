// End-to-end detection check with the REAL pipeline: headless Chrome, its fake camera fed with
// tests/fixtures/clips/e2e-three-gestures.mjpeg (build: python3 scripts/build_e2e_clip.py), the
// page's own MediaPipe landmarkers and rules, judged against tests/fixtures/clips/e2e-labels.json.
//   node scripts/e2e-camera.mjs [url]        default http://localhost:4173/ (npm run build && npm run preview)
//   CLIP=/path/to.mjpeg LABELS=/path/to.json  other clip; GPU=1 uses the Mac GPU instead of SwiftShader;
//   WIDTH=390 for the phone layout.  Exit code 1 when the clip fails its ground truth.
// Firings are read from the page's own emote box (#emote-name becoming visible), the same thing a
// visitor sees, so a pass here means the whole path works: camera frame -> landmarks -> rules -> emote.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:4173/";
const clip = resolve(process.env.CLIP ?? "tests/fixtures/clips/e2e-three-gestures.mjpeg");
const labels = JSON.parse(readFileSync(resolve(process.env.LABELS ?? "tests/fixtures/clips/e2e-labels.json"), "utf8"));
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WINDOW = 1000;

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${clip}`,
    "--autoplay-policy=no-user-gesture-required",
    ...(process.env.GPU ? ["--use-gl=angle", "--use-angle=metal"] : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]),
    "--window-size=1000,1400",
  ],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: Number(process.env.WIDTH ?? 1000), height: 1400 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // MediaPipe's WASM prints TFLite's INFO / warning lines through console.error; only real errors count (D8).
  page.on("console", (m) => { if (m.type() === "error" && !/^(INFO:|[WI]\d{4} )/.test(m.text())) errors.push(m.text()); });
  await page.goto(url, { waitUntil: "networkidle0" });
  // Record every time the emote box appears, with the page clock, from inside the page.
  await page.evaluate(() => {
    window.__fires = [];
    // The fake camera starts looping the file when the stream starts, several seconds before the
    // models are ready, so the clip position is recovered from the <video> "playing" moment.
    document.getElementById("video").addEventListener("playing", () => { window.__streamAt ??= performance.now(); }, { once: true });
    const box = document.getElementById("emote");
    new MutationObserver(() => {
      if (!box.classList.contains("hidden") && box.classList.contains("pop")) {
        const name = document.getElementById("emote-name").textContent;
        const last = window.__fires[window.__fires.length - 1];
        if (!last || last.name !== name || performance.now() - last.at > 500) window.__fires.push({ name, at: performance.now() });
      }
    }).observe(box, { attributes: true, attributeFilter: ["class"] });
  });
  await page.click("#start-camera");
  await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("Watching"), { timeout: 120_000 });
  const { t0, streamAt } = await page.evaluate(() => ({ t0: performance.now(), streamAt: window.__streamAt }));
  // Watch one full loop from the moment detection started; report each fire at its position in the clip.
  await new Promise((r) => setTimeout(r, labels.durationMs + 500));
  const D = labels.durationMs;
  const raw = await page.evaluate(() => window.__fires);
  // Exactly one loop is judged: a fire seen after D ms belongs to the next pass of the clip.
  const fires = raw
    .map((f) => ({ name: f.name, ms: Math.round((f.at - streamAt) % D), sinceStart: Math.round(f.at - t0), pass: Math.floor((f.at - streamAt) / D) }))
    .filter((f) => f.sinceStart < D);
  const phase = Math.round((t0 - streamAt) % D);
  console.log(`clip ${labels.file} (${D} ms), url ${url}; models ready ${Math.round(t0 - streamAt)} ms after the stream started (clip position ${phase} ms)`);
  console.log(`fires (clip position): ${fires.map((f) => `${f.name}@${f.ms}`).join(" ") || "none"}`);
  const nameOf = { flex: "Goblin Muscle", thumbs_up: "Thumbs Up", yawn: "Princess Yawn" };
  const problems = [];
  const left = [...fires];
  // An event that was already in progress when the models became ready is judged on its next loop pass,
  // which the one-loop window still covers; a fire counts for an event from 400 ms before it to its end.
  // An event may list `accept`: other gestures whose emote also satisfies it (a flexing fist the hand model reads as a thumbs-up).
  const inEvent = (f, ev) => (f.name === nameOf[ev.gesture] || (ev.accept ?? []).some((g) => f.name === nameOf[g])) && f.ms >= ev.startMs - 400 && f.ms <= ev.endMs;
  for (const ev of labels.events) {
    const i = left.findIndex((f) => inEvent(f, ev));
    if (i === -1) problems.push(`missed ${ev.gesture} (${ev.startMs}-${ev.endMs} ms)`);
    else {
      const f = left.splice(i, 1)[0];
      if (f.ms - ev.startMs > WINDOW) problems.push(`${ev.gesture} late: ${f.ms - ev.startMs} ms after onset`);
      // The one-loop window can reach the same event again on the clip's next pass when the models became
      // ready mid-clip (D9): a second fire for the same event in a LATER pass is that pass's fire, not a
      // re-fire; one in the SAME pass is a genuine re-fire while held.
      for (let j = left.length - 1; j >= 0; j--) if (inEvent(left[j], ev) && left[j].pass !== f.pass) left.splice(j, 1);
    }
  }
  for (const f of left) problems.push(`false trigger: ${f.name} at ${f.ms} ms`);
  if (errors.length) problems.push(`console errors: ${errors.join(" | ")}`);
  console.log(problems.length ? `FAIL: ${problems.join("; ")}` : "PASS: every gesture fired once within 1 s, nothing else fired");
  process.exitCode = problems.length ? 1 : 0;
} finally {
  await browser.close();
}
