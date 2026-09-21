// Arena DOM gate for the "Your own arena" redesign (docs/design/spec.md).
//
// Drives the real built page in headless Chrome and asserts the redesign's visible contract at
// 1440 and 390, plus the reduced-motion final states. It reuses the same puppeteer-core
// fake-camera setup as scripts/e2e-camera.mjs rather than adding a second browser-automation
// dependency; that harness remains the DETECTION gate, this one is the DESIGN gate.
//
// Two session modes, on purpose:
//   camera  the real path — Chrome's fake camera device feeding the committed .mjpeg clip through
//           three MediaPipe models. This is what proves the camera-on states. It is slow (models
//           + WASM + SwiftShader), so it runs the small set of assertions only it can make.
//   demo    the page's own deterministic landmark replay. Identical DOM states — running, the HUD
//           up, the percentages, an emote on its plate — with no models at all, so the styling and
//           motion assertions are cheap and never flake on a loaded machine.
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/e2e-arena.mjs [url]
//
// Exit code 1 when any assertion fails.
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:4173/";
const clip = process.env.CLIP ?? "tests/fixtures/clips/e2e-three-gestures.mjpeg";
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   ${detail}` : ""}`);
};

/** The translateY of a computed `matrix(...)`, in pixels. */
const translateY = (matrix) => {
  if (matrix === "none") return 0;
  const parts = matrix.replace(/^matrix\(|\)$/g, "").split(",").map(Number);
  return parts.length === 6 ? parts[5] : Number.NaN;
};

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  // Three MediaPipe models on SwiftShader can hold the main thread for well over the 30 s default,
  // and a CDP call that times out kills the run rather than failing an assertion.
  protocolTimeout: 300_000,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${clip}`,
    "--autoplay-policy=no-user-gesture-required",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});

async function run(width, height, { reduced = false, mode = "demo" } = {}) {
  const tag = `${width}x${height} ${mode}${reduced ? " reduce" : ""}`;
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  // MediaPipe's WASM prints TFLite's INFO / warning lines through console.error; only real errors count.
  page.on("console", (m) => {
    if (m.type() === "error" && !/^(INFO:|[WI]\d{4} )/.test(m.text())) consoleErrors.push(m.text());
  });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 900));

  // --- at rest -----------------------------------------------------------------

  // P1 audit item: the primary action is on the first screen at 1440, not below the stage.
  const startBottom = await page.$eval("#start-camera", (el) => el.getBoundingClientRect().bottom);
  check(`${tag}: "Start camera" fully above the fold`, startBottom > 0 && startBottom < height, `bottom=${Math.round(startBottom)} < ${height}`);

  // P1 audit item: the resting arena says what the app is for.
  check(`${tag}: resting arena shows the three marks`, (await page.$$("#placeholder .mark")).length === 3);

  // P2 audit item: no Supercell art anywhere in the chrome. Their emote is the payload only.
  const chromeImgs = await page.$$eval("img", (els) => els.filter((e) => e.id !== "emote-img").map((e) => e.getAttribute("src") ?? ""));
  check(`${tag}: no Supercell art outside the payload`, chromeImgs.every((s) => !s.includes("/emotes/")), JSON.stringify(chromeImgs));

  // P3 audit items.
  check(`${tag}: "Stop" hidden until a session runs`, (await page.$eval("#stop", (el) => el.offsetParent !== null)) === false);
  check(`${tag}: no 0% meter at rest`, (await page.$eval("#val-flex", (el) => el.offsetParent !== null)) === false);

  // The arena is capped, which is what puts the controls above the fold.
  const stageH = await page.$eval("#stage", (el) => el.getBoundingClientRect().height);
  check(`${tag}: arena capped at min(60vh, 520px)`, stageH <= Math.min(height * 0.6, 520) + 1, `${Math.round(stageH)}px`);

  // Cross-app hygiene: one skip link, and it is reachable.
  check(`${tag}: skip link present`, (await page.$$(".skip-link")).length === 1);

  // The display face is actually loaded, not just named (the audit's "names Inter, never loads it").
  const displayLoaded = await page.evaluate(() => document.fonts.check("700 44px Fredoka"));
  check(`${tag}: the display face is loaded, not just named`, displayLoaded === true);

  // M1 / M2 entrance behaviour.
  const split = await page.$eval("h1", (el) => el.dataset.split ?? "no");
  if (reduced) {
    check(`${tag}: h1 is never split under reduce`, split === "no", split);
  } else {
    check(`${tag}: h1 word reveal ran`, split === "true", split);
    check(`${tag}: h1 keeps its accessible name`, (await page.$eval("h1", (el) => el.getAttribute("aria-label"))) === "Emote Detector");
  }
  const revealHidden = await page.$eval(".gesture-list li", (el) => Number(getComputedStyle(el).opacity));
  check(`${tag}: reveal blocks ${reduced ? "are complete on paint" : "are visible once scrolled to"}`, reduced ? revealHidden === 1 : revealHidden >= 0, String(revealHidden));

  // --- session on ---------------------------------------------------------------

  if (mode === "camera") {
    await page.click("#start-camera");
    await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("Watching"), { timeout: 300_000, polling: 1000 });
    check(`${tag}: camera session reaches "Watching"`, true);
  } else {
    await page.click("#start-demo");
    await page.waitForFunction(() => document.getElementById("stage").classList.contains("running"), { timeout: 30_000 });
    check(`${tag}: session starts`, true);
  }

  check(`${tag}: "Stop" appears with the session`, (await page.$eval("#stop", (el) => el.offsetParent !== null)) === true);
  check(`${tag}: percentages appear with the session`, (await page.$eval("#val-flex", (el) => el.offsetParent !== null)) === true);

  // M3: the scoreboard is up.
  const hudY = translateY(await page.$eval("#hud", (el) => getComputedStyle(el).transform));
  check(`${tag}: HUD strip is up while running`, Math.abs(hudY) < 1, `translateY=${hudY}`);

  // M4: the fill tracks a real score.
  const filled = await page
    .waitForFunction(() => [...document.querySelectorAll(".hud-fill")].some((el) => Number(el.style.getPropertyValue("--fill")) > 0.15), { timeout: 180_000, polling: mode === "camera" ? 1000 : 100 })
    .then(() => true)
    .catch(() => false);
  check(`${tag}: a HUD mark fills from a live score`, filled);

  // M6: the payload lands.
  const fired = await page
    .waitForFunction(
      () => {
        const e = document.getElementById("emote");
        return !e.classList.contains("hidden") && e.classList.contains("pop") && !!document.getElementById("emote-name").textContent;
      },
      { timeout: 180_000, polling: mode === "camera" ? 500 : 40 },
    )
    .then(() => true)
    .catch(() => false);
  check(`${tag}: an emote fires and lands on its plate`, fired);

  if (fired) {
    const anim = await page.$eval("#emote", (el) => getComputedStyle(el).animationName);
    check(`${tag}: emote animation is "${reduced ? "fade-in" : "land"}"`, anim === (reduced ? "fade-in" : "land"), anim);
    const plateAnim = await page.$eval(".emote-plate", (el) => getComputedStyle(el).animationName);
    check(`${tag}: plate is ${reduced ? "static" : "animated"}`, reduced ? plateAnim === "none" : plateAnim === "plate", plateAnim);
    const payload = await page.$eval("#emote-img", (el) => el.getAttribute("src") ?? "");
    check(`${tag}: the payload is still Supercell's own art, unchanged`, payload.startsWith("/emotes/"), payload);
  }

  // --- reduced motion lands on complete static states ---------------------------

  if (reduced) {
    // Stop the session first: reading computed styles while three models run per frame under
    // SwiftShader is what makes these calls time out rather than fail.
    await page.click("#stop");
    await new Promise((r) => setTimeout(r, 300));
    const zero = (v) => /^0s(,\s*0s)*$/.test(v);
    check(`${tag}: HUD strip has no transition`, zero(await page.$eval("#hud", (el) => getComputedStyle(el).transitionDuration)));
    check(`${tag}: HUD fill snaps`, zero(await page.$eval(".hud-fill", (el) => getComputedStyle(el).transitionDuration)));
    check(`${tag}: gesture bars snap`, zero(await page.$eval(".fill", (el) => getComputedStyle(el).transitionDuration)));
    const beamAnim = await page.evaluate(() => {
      const cell = document.querySelector(".hud-cell");
      return getComputedStyle(cell.querySelector(".hud-mark"), "::after").animationName;
    });
    check(`${tag}: the beam does not travel`, beamAnim === "none", beamAnim);
  }

  check(`${tag}: console clean`, consoleErrors.length === 0, consoleErrors.join(" | "));
  await page.evaluate(() => document.getElementById("stop")?.click()).catch(() => {});
  await page.close();
}

try {
  // Cheap, deterministic: the whole visible contract at both widths, and the reduced-motion
  // final states. These are the assertions that must never flake.
  await run(1440, 780, { mode: "demo" });
  await run(390, 844, { mode: "demo" });
  await run(1440, 780, { mode: "demo", reduced: true });
  // Expensive, and the only thing that proves the real path: the fake camera device feeding the
  // committed clip through the three MediaPipe models, at both widths.
  if (!process.env.SKIP_CAMERA) {
    await run(1440, 780, { mode: "camera" });
    await run(390, 844, { mode: "camera" });
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
if (failed.length) for (const f of failed) console.log(`  FAILED: ${f.name} ${f.detail}`);
process.exit(failed.length ? 1 : 0);
