import type { Env } from "./types";

export const TRANSLATE_MODEL = "@cf/meta/m2m100-1.2b";
export const TRANSLATE_TARGETS = ["it", "de", "fr"] as const;
export const MAX_TRANSLATE_CHARS = 4000;

export type CaptionTranslations = { it: string; de: string; fr: string };

type TranslateResult = { ok: true; translations: CaptionTranslations } | { ok: false; error: string; status: number };

function readTranslatedText(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const text = (raw as { translated_text?: unknown }).translated_text;
  return typeof text === "string" ? text.trim() : "";
}

export async function translateFromEnglish(env: Env, text: string): Promise<TranslateResult> {
  const source = String(text || "").trim();
  if (!source) return { ok: false, error: "text is required", status: 400 };
  if (source.length > MAX_TRANSLATE_CHARS) return { ok: false, error: "text too long", status: 400 };
  if (!env.AI) return { ok: false, error: "translation is not configured", status: 503 };

  const translations: CaptionTranslations = { it: "", de: "", fr: "" };
  try {
    await Promise.all(
      TRANSLATE_TARGETS.map(async (lang) => {
        const out = await env.AI!.run(TRANSLATE_MODEL, {
          text: source,
          source_lang: "en",
          target_lang: lang,
        });
        const line = readTranslatedText(out);
        if (!line) throw new Error(`empty ${lang} translation`);
        translations[lang] = line;
      })
    );
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "translation failed", status: 502 };
  }
  return { ok: true, translations };
}
