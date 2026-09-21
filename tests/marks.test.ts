import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GESTURES } from "../src/gestures/engine";
import { MARK_ID, markHref } from "../src/marks";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

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

  it("has a drawn <symbol> in index.html for every mark", () => {
    for (const g of GESTURES) expect(html).toContain(`<symbol id="${MARK_ID[g]}"`);
  });

  it("draws every mark in one stroke system", () => {
    for (const g of GESTURES) {
      const start = html.indexOf(`<symbol id="${MARK_ID[g]}"`);
      const symbol = html.slice(start, html.indexOf("</symbol>", start));
      expect(symbol, g).toContain('stroke="currentColor"');
      expect(symbol, g).toContain('stroke-width="3"');
      expect(symbol, g).toContain('stroke-linecap="round"');
      expect(symbol, g).toContain('vector-effect="non-scaling-stroke"');
      expect(symbol, g).toContain('viewBox="0 0 32 32"');
    }
  });

  it("keeps Supercell's art out of the chrome: it is referenced only by the emote payload", () => {
    const refs = [...html.matchAll(/src="(\/emotes\/[^"]+)"/g)].map((m) => m[1]);
    expect(refs).toEqual([]);
  });

  it("uses a mark, not borrowed art, for the favicon", () => {
    const favicon = readFileSync(join(ROOT, "public/favicon.svg"), "utf8");
    expect(favicon).toContain("#ffc43d");
    expect(favicon).not.toContain("/emotes/");
  });
});
