import { describe, expect, it, vi } from "vitest";
import type { Env } from "./types";
import { translateFromEnglish } from "./translate";

function envWithAi(
  run: (
    model: string,
    input: { text: string; source_lang: string; target_lang: string }
  ) => Promise<{ translated_text?: string }>
): Env {
  return { AI: { run } } as Env;
}

describe("translateFromEnglish", () => {
  it("rejects empty text", async () => {
    const out = await translateFromEnglish({} as Env, "   ");
    expect(out).toEqual({ ok: false, error: "text is required", status: 400 });
  });

  it("rejects when Workers AI is not bound", async () => {
    const out = await translateFromEnglish({} as Env, "Hello");
    expect(out).toEqual({ ok: false, error: "translation is not configured", status: 503 });
  });

  it("fills it, de and fr from English", async () => {
    const run = vi.fn(async (_model: string, input: { target_lang: string }) => ({
      translated_text: input.target_lang === "it" ? "Ciao" : input.target_lang === "de" ? "Hallo" : "Salut",
    }));
    const out = await translateFromEnglish(envWithAi(run), "Hi");
    expect(out).toEqual({ ok: true, translations: { it: "Ciao", de: "Hallo", fr: "Salut" } });
    expect(run).toHaveBeenCalledTimes(3);
  });
});
