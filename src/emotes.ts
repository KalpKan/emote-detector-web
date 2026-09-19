/**
 * The three emotes the app can fire (config/emotes_config.json in the Python app)
 * and the spam guard that keeps one emote from playing over another.
 */
import type { Gesture } from "./gestures/engine";

export type Emote = {
  id: "goblin_muscle" | "princess_yawn" | "thumbs_up";
  name: string;
  gesture: Gesture;
  image: string;
  sound: string;
  hint: string;
};

export const EMOTES: readonly Emote[] = [
  {
    id: "goblin_muscle",
    name: "Goblin Muscle",
    gesture: "flex",
    image: "/emotes/goblin_muscle.png",
    sound: "/emotes/goblin_muscle.mp3",
    hint: "Flex: bend one arm and bring your fist up beside your head.",
  },
  {
    id: "princess_yawn",
    name: "Princess Yawn",
    gesture: "yawn",
    image: "/emotes/princess_yawn.png",
    sound: "/emotes/princess_yawn.mp3",
    hint: "Yawn: open wide and let your eyes narrow.",
  },
  {
    id: "thumbs_up",
    name: "Thumbs Up",
    gesture: "thumbs_up",
    image: "/emotes/thumbs_up.png",
    sound: "/emotes/thumbs_up.mp3",
    hint: "Thumbs up: fingers folded, thumb straight up, in front of the camera.",
  },
];

export function emoteForGesture(gesture: Gesture): Emote {
  const emote = EMOTES.find((e) => e.gesture === gesture);
  if (!emote) throw new Error(`no emote for gesture ${gesture}`);
  return emote;
}

/** `audio_spam_prevention_ms` from the Python config: the same emote cannot play again within this. */
export const COOLDOWN_MS = 2000;
/** Any two emotes are at least this far apart, so one sound does not talk over another (FIX round 2, D2). */
export const GAP_MS = 700;

/** What the gate needs from a frame: the engine's edge and which gestures are still held. */
export type GateInput = { fired: Gesture | null; actives: readonly Gesture[] };

/**
 * Decides when a gesture edge plays its emote. Pure timing logic, so it is
 * testable without audio; the page plays the sound when this returns an emote.
 *
 * FIX round 2 (D2): the engine reports an edge on exactly one frame, and the old
 * gate dropped it when it fell inside the 2 s cooldown, so a gesture done within
 * ~1.5 s of the previous one never played. Now an edge that cannot play yet is
 * kept pending and plays as soon as it may, provided its gesture is still held;
 * and only a REPEAT of the same emote waits the full cooldown (the engine's
 * release rule already guarantees one fire per hold), a different emote only
 * needs GAP_MS.
 */
export class EmoteGate {
  private lastFiredAt = -Infinity;
  private lastGesture: Gesture | null = null;
  private pending: Gesture | null = null;

  constructor(
    private readonly cooldownMs: number = COOLDOWN_MS,
    private readonly gapMs: number = GAP_MS,
  ) {}

  /** Call once per frame with the engine's result; returns the emote to play now, if any. */
  update(frame: GateInput, now: number): Emote | null {
    if (frame.fired) this.pending = frame.fired;
    if (this.pending === null) return null;
    if (!frame.actives.includes(this.pending)) {
      // Released before it could play: it was a blip, not a gesture that deserves a late emote.
      this.pending = null;
      return null;
    }
    const wait = this.pending === this.lastGesture ? this.cooldownMs : this.gapMs;
    if (now - this.lastFiredAt < wait) return null;
    const gesture = this.pending;
    this.pending = null;
    this.lastFiredAt = now;
    this.lastGesture = gesture;
    return emoteForGesture(gesture);
  }

  /** Milliseconds until the same emote may play again (0 when ready). */
  remaining(now: number): number {
    return Math.max(0, this.cooldownMs - (now - this.lastFiredAt));
  }

  reset(): void {
    this.lastFiredAt = -Infinity;
    this.lastGesture = null;
    this.pending = null;
  }
}
