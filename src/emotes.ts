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

/** `audio_spam_prevention_ms` from the Python config. */
export const COOLDOWN_MS = 2000;

/**
 * Decides whether a gesture edge may fire an emote right now. Pure timing logic,
 * so it is testable without audio; the page plays the sound when this says yes.
 */
export class EmoteGate {
  private lastFiredAt = -Infinity;

  constructor(private readonly cooldownMs: number = COOLDOWN_MS) {}

  tryFire(gesture: Gesture, now: number): Emote | null {
    if (now - this.lastFiredAt < this.cooldownMs) return null;
    this.lastFiredAt = now;
    return emoteForGesture(gesture);
  }

  /** Milliseconds until the next emote may fire (0 when ready). */
  remaining(now: number): number {
    return Math.max(0, this.cooldownMs - (now - this.lastFiredAt));
  }
}
