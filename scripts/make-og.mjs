// Renders public/og.png (1200x630) with headless Chrome, from the same three authored marks,
// the same palette and the same display face as the page. No new dependency, no Supercell art.
//
//   node scripts/make-og.mjs
//
// Re-run it whenever the marks, the wordmark or the palette change.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const root = resolve(import.meta.dirname, "..");
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const font = readFileSync(resolve(root, "public/fonts/fredoka-700-latin.woff2")).toString("base64");

// The three marks, copied from index.html's <symbol> sprite. One stroke system.
const MARKS = {
  thumbs_up: `<path d="M13 13.8 17.2 4.6a3.6 3.6 0 0 1 3.4 3.6v4.4h4.9a2.6 2.6 0 0 1 2.56 3.05l-1.45 8.2a2.8 2.8 0 0 1-2.76 2.35H13Z"/><rect x="4" y="13.8" width="7.6" height="12.4" rx="2.4"/>`,
  flex: `<path d="M18.4 4.2h2.6a3.6 3.6 0 0 1 3.6 3.6v17a3.2 3.2 0 0 1-3.2 3.2H8a3.5 3.5 0 0 1-3.5-3.5v-6.1C4.5 14.2 11 11.4 18.4 12.4Z"/><path d="M18.6 10.4h6.8"/><path d="M9.2 23.8c1.4-3.6 4.4-5.6 8.4-5.8"/>`,
  yawn: `<circle cx="16" cy="16" r="12.6"/><path d="M8.4 12.1q2.5 2.5 5 0"/><path d="M18.6 12.1q2.5 2.5 5 0"/><ellipse cx="16" cy="21.6" rx="4.8" ry="5.6"/>`,
};

const mark = (d) =>
  `<svg viewBox="0 0 32 32" width="96" height="96"><g fill="none" stroke="#ffc43d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${d}</g></svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Fredoka"; font-weight: 700; src: url(data:font/woff2;base64,${font}) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
body {
  width: 1200px; height: 630px; display: grid; align-content: center; gap: 34px;
  padding: 0 88px; color: #f3edff;
  font: 16px/1.5 system-ui, sans-serif;
  background:
    radial-gradient(120% 70% at 50% 128%, rgba(255,196,61,0.16), transparent 62%),
    #120b1f;
}
/* The same chamfer family as the page, at the poster's scale. */
.frame {
  position: absolute; inset: 40px; pointer-events: none;
  --cut: 34px;
  padding: 2px;
  background: linear-gradient(150deg, rgba(255,196,61,.85), rgba(255,196,61,.28) 46%, rgba(255,196,61,.55));
  clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut));
}
.frame > div { width: 100%; height: 100%; background:
  radial-gradient(120% 70% at 50% 126%, rgba(255,196,61,0.14), transparent 62%), #120b1f;
  clip-path: inherit; }
.inner { position: relative; }
h1 { font: 700 92px/1 "Fredoka", system-ui, sans-serif; letter-spacing: -0.015em; }
.eyebrow { font: 400 20px/1 ui-monospace, Menlo, monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #b3a6cc; }
.marks { display: flex; gap: 52px; }
.sub { font-size: 25px; line-height: 1.45; color: #b3a6cc; max-width: 30ch; }
.host { position: absolute; left: 88px; bottom: 74px; font: 400 19px/1 ui-monospace, Menlo, monospace; color: #ffc43d; letter-spacing: .08em; }
</style></head><body>
<div class="frame"><div></div></div>
<div class="inner" style="display:grid;gap:34px">
  <div class="marks">${mark(MARKS.thumbs_up)}${mark(MARKS.flex)}${mark(MARKS.yawn)}</div>
  <div style="display:grid;gap:12px">
    <h1>Emote Detector</h1>
    <p class="eyebrow">Computer vision, in the browser</p>
  </div>
  <p class="sub">Thumbs-up, flex or yawn at your webcam. Nothing leaves your device.</p>
</div>
<div class="host">emotes.kalpkan.com</div>
</body></html>`;

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluateHandle("document.fonts.ready");
  const buf = await page.screenshot({ type: "png" });
  writeFileSync(resolve(root, "public/og.png"), buf);
  console.log(`wrote public/og.png (${buf.length} bytes)`);
} finally {
  await browser.close();
}
