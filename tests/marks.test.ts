import { describe, expect, it } from "vitest";
import { GESTURES } from "../src/gestures/engine";
import { MARK_ID, markHref } from "../src/marks";

describe("gesture marks", () => {
  it("names a mark for every gesture the engine can report", () => {
    for (const g of GESTURES) expect(MARK_ID[g]).toMatch(/^mark-[a-z_]+$/);
  });

  it("gives every gesture its own mark", () => {
    const ids = GESTURES.map((g) => MARK_ID[g]);
    expect(new Set(ids).size).toBe(GESTURES.length);
  });

  it("builds a same-document href", () => {
    expect(markHref("flex")).toBe("#mark-flex");
  });
});
