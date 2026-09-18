import { capture, initAnalytics } from "./analytics";
import { DemoSource } from "./demo";
import { drawOverlay } from "./draw";
import { COOLDOWN_MS, EMOTES, EmoteGate, type Emote } from "./emotes";
import { faceMetrics } from "./gestures/face";
import { GESTURES, GestureEngine, type Gesture } from "./gestures/engine";
import type { Pt } from "./gestures/geometry";
import { loadLandmarkers, type Landmarkers } from "./landmarkers";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const video = $<HTMLVideoElement>("video");
const canvas = $<HTMLCanvasElement>("overlay");
const stage = $<HTMLDivElement>("stage");
const placeholder = $<HTMLDivElement>("placeholder");
const status = $<HTMLParagraphElement>("status");
const startCameraBtn = $<HTMLButtonElement>("start-camera");
const startDemoBtn = $<HTMLButtonElement>("start-demo");
const stopBtn = $<HTMLButtonElement>("stop");
const emoteBox = $<HTMLDivElement>("emote");
const emoteImg = $<HTMLImageElement>("emote-img");
const emoteName = $<HTMLSpanElement>("emote-name");
const demoCaption = $<HTMLDivElement>("demo-caption");
const ctx = canvas.getContext("2d")!;

const meters: Record<Gesture, { bar: HTMLDivElement; value: HTMLSpanElement }> = {
  flex: { bar: $("bar-flex"), value: $("val-flex") },
  thumbs_up: { bar: $("bar-thumbs_up"), value: $("val-thumbs_up") },
  yawn: { bar: $("bar-yawn"), value: $("val-yawn") },
};

type Source = { kind: "camera"; stream: MediaStream } | { kind: "demo"; demo: DemoSource; frameIndex: number };

let source: Source | null = null;
let landmarkers: Landmarkers | null = null;
let rafId = 0;
let demoTimer = 0;
let lastTs = 0;
let lastTick = 0;
const engine = new GestureEngine();
const gate = new EmoteGate(COOLDOWN_MS);
const sounds = new Map<Emote["id"], HTMLAudioElement>();
let emoteTimer = 0;

const DEMO_W = 640;
const DEMO_H = 480;
const MIN_FRAME_MS = 40; // ~25 fps cap keeps phones cool

function setStatus(text: string): void {
  status.textContent = text;
}

/** Audio must be created inside a user gesture (iOS Safari), so this runs from the click handlers. */
function prepareSounds(): void {
  if (sounds.size) return;
  for (const e of EMOTES) {
    const a = new Audio(e.sound);
    a.preload = "auto";
    a.load();
    sounds.set(e.id, a);
  }
}

function showEmote(emote: Emote): void {
  emoteImg.src = emote.image;
  emoteImg.alt = emote.name;
  emoteName.textContent = emote.name;
  emoteBox.classList.remove("hidden");
  emoteBox.classList.remove("pop");
  void emoteBox.offsetWidth; // restart the animation
  emoteBox.classList.add("pop");
  const a = sounds.get(emote.id);
  if (a) {
    a.currentTime = 0;
    a.play().catch(() => {
      /* autoplay blocked: the image still shows */
    });
  }
  window.clearTimeout(emoteTimer);
  emoteTimer = window.setTimeout(() => emoteBox.classList.add("hidden"), 1800);
  capture("emote_fired", { emote: emote.id });
}

function updateMeters(scores: Record<Gesture, number>, active: Gesture | null): void {
  for (const g of GESTURES) {
    const pct = Math.round(scores[g] * 100);
    meters[g].bar.style.width = `${pct}%`;
    meters[g].value.textContent = `${pct}%`;
    meters[g].bar.parentElement!.classList.toggle("active", active === g);
  }
}

function handleResult(input: { pose: Pt[] | null; hands: Pt[][]; face: Pt[] | null }, aspect: number, figure: boolean): void {
  const result = engine.update({
    pose: input.pose,
    hands: input.hands,
    face: faceMetrics(input.face, aspect),
  });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawOverlay(ctx, { pose: input.pose, hands: input.hands, face: input.face, figure });
  updateMeters(result.scores, result.active);
  if (result.fired) {
    const emote = gate.tryFire(result.fired, performance.now());
    if (emote) showEmote(emote);
  }
}

function cameraTick(now: number): void {
  if (!source || source.kind !== "camera" || !landmarkers) return;
  rafId = requestAnimationFrame(cameraTick);
  if (video.readyState < 2 || now - lastTick < MIN_FRAME_MS) return;
  lastTick = now;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  // MediaPipe VIDEO mode needs strictly increasing timestamps.
  lastTs = Math.max(lastTs + 1, Math.round(now));
  const pose = landmarkers.pose.detectForVideo(video, lastTs).landmarks[0] ?? null;
  const hands = landmarkers.hands.detectForVideo(video, lastTs).landmarks;
  const face = landmarkers.face.detectForVideo(video, lastTs).faceLandmarks[0] ?? null;
  handleResult({ pose, hands, face }, video.videoWidth / video.videoHeight, false);
}

/**
 * The demo advances a fixed 40 ms per tick (a timer, not requestAnimationFrame),
 * so it is deterministic: the same frames, in the same order, on every device.
 */
function demoTick(): void {
  if (!source || source.kind !== "demo") return;
  source.frameIndex += 1;
  const frame = source.demo.frame(source.frameIndex * (MIN_FRAME_MS / 1000));
  demoCaption.textContent = frame.label;
  handleResult({ pose: frame.pose, hands: frame.hands, face: frame.face }, DEMO_W / DEMO_H, true);
  demoTimer = window.setTimeout(demoTick, MIN_FRAME_MS);
}

function setRunning(running: boolean, kind: Source["kind"] | null): void {
  startCameraBtn.disabled = running;
  startDemoBtn.disabled = running;
  stopBtn.disabled = !running;
  stage.classList.toggle("running", running);
  stage.classList.toggle("demo", kind === "demo");
  stage.classList.toggle("camera", kind === "camera");
  placeholder.classList.toggle("hidden", running);
  demoCaption.classList.toggle("hidden", kind !== "demo");
}

async function ensureModels(): Promise<Landmarkers> {
  if (landmarkers) return landmarkers;
  landmarkers = await loadLandmarkers(setStatus);
  return landmarkers;
}

async function startCamera(): Promise<void> {
  prepareSounds();
  setRunning(true, "camera");
  try {
    setStatus("Asking for the camera…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    await ensureModels();
    engine.reset();
    source = { kind: "camera", stream };
    lastTick = 0;
    setStatus("Watching. Try a thumbs-up, a flex beside your head, or a big yawn.");
    capture("session_started", { source: "camera" });
    rafId = requestAnimationFrame(cameraTick);
  } catch (err) {
    console.error(err);
    stop();
    const name = err instanceof DOMException ? err.name : "";
    setStatus(
      name === "NotAllowedError"
        ? "Camera permission was refused. You can still press “Play demo”."
        : name === "NotFoundError"
          ? "No camera found. Press “Play demo” to see it work anyway."
          : "Could not start the camera or load the models. Try “Play demo” or reload the page.",
    );
  }
}

async function startDemo(): Promise<void> {
  prepareSounds();
  setRunning(true, "demo");
  try {
    canvas.width = DEMO_W;
    canvas.height = DEMO_H;
    engine.reset();
    source = { kind: "demo", demo: new DemoSource(), frameIndex: 0 };
    lastTick = 0;
    setStatus("Demo: replaying recorded landmarks through the same detector (no camera used).");
    capture("session_started", { source: "demo" });
    capture("demo_video_played");
    demoTick();
  } catch (err) {
    console.error(err);
    stop();
    setStatus("The demo could not start. Reload the page and try again.");
  }
}

function stop(): void {
  cancelAnimationFrame(rafId);
  window.clearTimeout(demoTimer);
  if (source?.kind === "camera") {
    for (const t of source.stream.getTracks()) t.stop();
    video.srcObject = null;
  }
  source = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateMeters({ flex: 0, thumbs_up: 0, yawn: 0 }, null);
  emoteBox.classList.add("hidden");
  setRunning(false, null);
  setStatus("Stopped.");
}

startCameraBtn.addEventListener("click", () => void startCamera());
startDemoBtn.addEventListener("click", () => void startDemo());
stopBtn.addEventListener("click", stop);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && source?.kind === "camera") stop();
});

if (!navigator.mediaDevices?.getUserMedia) {
  startCameraBtn.disabled = true;
  setStatus("This browser has no camera API. Press “Play demo”.");
}

window.addEventListener("load", () => initAnalytics());
