/**
 * Consumer-grade gate on the labelled photo corpus (docs/reports/emotes-spec.md §3, S2-S5, frame level).
 * Ground truth: tests/fixtures/stills/index.json (kinds in labels.json).
 * Report with numbers: npx vite-node scripts/eval-corpus.ts --verbose
 */
import { describe, expect, it } from "vitest";
import { GESTURES, loadStills, metrics, scoreStill } from "./corpus";

const T = 15_000;
const stills = loadStills().filter((s) => s.kind !== "skip");
const rows = stills.map((s) => {
  const scores = scoreStill(s);
  return { ...s, scores, fired: GESTURES.filter((g) => scores[g] >= 0.5) };
});
const gated = rows.filter((r) => r.kind === "ok" || r.kind === "neutral" || r.kind === "hard");
const m = metrics(gated);

describe("photo corpus (95 real MediaPipe landmark sets)", () => {
  it("loads every labelled still", { timeout: T }, () => {
    expect(stills.length).toBe(94);
    expect(rows.filter((r) => r.kind === "ok").length).toBe(42);
    expect(rows.filter((r) => r.kind === "neutral").length).toBe(9);
    expect(rows.filter((r) => r.kind === "hard").length).toBe(33);
  });

  for (const g of GESTURES) {
    it(`${g}: recall >= 90% on clear photos of the gesture`, { timeout: T }, () => {
      const missed = rows.filter((r) => r.kind === "ok" && r.expected === g && !r.fired.includes(g)).map((r) => `${r.id} ${JSON.stringify(r.scores)}`);
      expect(m[g].recall, `missed: ${missed.join("; ")}`).toBeGreaterThanOrEqual(0.9);
    });
    it(`${g}: precision >= 90% (no other photo scores it)`, { timeout: T }, () => {
      const wrong = gated.filter((r) => r.expected !== g && r.fired.includes(g)).map((r) => `${r.id} (${r.kind}: ${r.note})`);
      expect(m[g].precision, `fired on: ${wrong.join("; ")}`).toBeGreaterThanOrEqual(0.9);
    });
  }

  it("a person at rest or talking never scores a gesture", { timeout: T }, () => {
    const wrong = rows.filter((r) => r.kind === "neutral" && r.fired.length).map((r) => `${r.id} -> ${r.fired.join(",")} (${r.note})`);
    expect(wrong, wrong.join("; ")).toEqual([]);
  });

  it("hard negatives (cover-eyes, dab, screams): at most 3 of 33 score anything", { timeout: T }, () => {
    const wrong = rows.filter((r) => r.kind === "hard" && r.fired.length).map((r) => `${r.id} -> ${r.fired.join(",")}`);
    expect(wrong.length, wrong.join("; ")).toBeLessThanOrEqual(3);
  });

  it("a yawn behind a hand, or a gesture the landmarkers cannot see, never scores a different gesture", { timeout: T }, () => {
    const wrong = rows.filter((r) => (r.kind === "occluded" || r.kind === "partial") && r.fired.some((g) => g !== r.expected)).map((r) => `${r.id} -> ${r.fired.join(",")} (${r.note})`);
    expect(wrong, wrong.join("; ")).toEqual([]);
  });
});
