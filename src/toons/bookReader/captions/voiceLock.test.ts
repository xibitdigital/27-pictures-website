import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const root = resolve(__dirname, "../../../..");

function loadJson(rel: string) {
  return JSON.parse(readFileSync(resolve(root, rel), "utf8"));
}

describe("caption voice lock", () => {
  const voices = loadJson("scripts/voices.json") as Record<string, string>;
  const names = new Set(Object.keys(voices));

  it.each(["erin", "erin-the-revenge"])("every spoken %s line names a voices.json key", (toon) => {
    const cfg = loadJson(`content/toons/${toon}/config.json`) as {
      pages: {
        words?: { voice?: string; variant?: string; text?: { en?: string }; stroke?: unknown }[];
      }[];
    };
    const missing: string[] = [];
    const bad: string[] = [];
    cfg.pages.forEach((page, pi) => {
      (page.words ?? []).forEach((w, wi) => {
        const en = w.text?.en ?? "";
        if (w.voice && !names.has(w.voice)) bad.push(`p${pi + 1}[${wi}] ${w.voice} ${en}`);
        const spoken =
          w.variant === "bubble" ||
          w.variant === "thought" ||
          w.variant === "credit" ||
          (w.variant === "burst" && /[a-z]/.test(en));
        if (spoken && !w.voice) missing.push(`p${pi + 1}[${wi}] ${en}`);
      });
    });
    expect(missing, missing.join("; ")).toEqual([]);
    expect(bad, bad.join("; ")).toEqual([]);
  });
});
