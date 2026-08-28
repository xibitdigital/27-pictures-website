/** config.json (reader shape) → rows the editor D1 stores. */

import { DESC_LANGS, emptyDescriptionMap } from "./apiTypes";
import type { BubbleRow, CaptionWord, DescriptionMap, ImportMeta, WordInput, WordRow } from "./types";

const CORE = new Set(["x", "y", "variant", "tail", "size", "angle", "text"]);

export function wordToRow(w: WordInput, sort: number): WordRow {
  const text: Record<string, unknown> =
    typeof w.text === "string" ? { en: w.text } : { ...((w.text as Record<string, unknown> | undefined) || {}) };
  const textEn = String(text.en || text.it || text.de || text.fr || "");
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(w || {})) {
    if (!CORE.has(k) && v !== undefined) extra[k] = v;
  }
  return {
    x: Number(w.x) || 0,
    y: Number(w.y) || 0,
    variant: String(w.variant || "bubble"),
    tail: w.tail != null ? String(w.tail) : null,
    size: w.size != null ? Number(w.size) : null,
    angle: w.angle != null ? Number(w.angle) : null,
    textEn,
    textJson: JSON.stringify(text),
    extraJson: Object.keys(extra).length ? JSON.stringify(extra) : null,
    sort,
  };
}

export function rowToWord(row: BubbleRow | WordRow | Record<string, unknown>): CaptionWord {
  const rec = row as Record<string, unknown>;
  let text: Record<string, string> = { en: String(rec.text_en || rec.textEn || "") };
  if (rec.text_json || rec.textJson) {
    try {
      text = JSON.parse(String(rec.text_json || rec.textJson)) as Record<string, string>;
    } catch {
      /* keep en fallback */
    }
  }
  const word: CaptionWord = {
    x: Number(rec.x),
    y: Number(rec.y),
    variant: String(rec.variant),
    text,
  };
  if (rec.tail) word.tail = String(rec.tail);
  if (rec.size != null) word.size = rec.size as number;
  if (rec.angle != null) word.angle = rec.angle as number;
  const extraRaw = rec.extra_json || rec.extraJson;
  if (extraRaw) {
    try {
      Object.assign(word, JSON.parse(String(extraRaw)));
    } catch {
      /* ignore */
    }
  }
  return word;
}

/** Episode card copy from the current series pages → extra.description. */
export function descriptionMapFromMeta(meta: ImportMeta | null | undefined): DescriptionMap {
  const map = emptyDescriptionMap();
  const incoming = meta && meta.descriptions && typeof meta.descriptions === "object" ? meta.descriptions : null;
  for (const lang of DESC_LANGS) {
    if (incoming && incoming[lang] != null) map[lang] = String(incoming[lang]).trim();
  }
  if (!map.en) map.en = String((meta && meta.description) || "").trim();
  return map;
}

export function configToImport(
  config: {
    pages?: { file: string; words?: WordInput[] }[];
    title?: string;
    designWidth?: number;
    designHeight?: number;
    defaultLang?: string;
    languages?: unknown;
    reverb?: unknown;
  },
  meta: ImportMeta
) {
  const pages = (config.pages || []).map((page, i) => ({
    position: i,
    file: page.file,
    words: (page.words || []).map((w, s) => wordToRow(w, s)),
  }));
  const extra: Record<string, unknown> = {};
  if (config.defaultLang) extra.defaultLang = config.defaultLang;
  if (config.languages) extra.languages = config.languages;
  if (config.reverb) extra.reverb = config.reverb;
  extra.description = descriptionMapFromMeta(meta);
  if (meta && meta.titles) {
    extra.title = descriptionMapFromMeta({ descriptions: meta.titles, description: meta.title });
  }
  return {
    slug: meta.slug,
    title: String(config.title || meta.title || meta.slug),
    subtitle: String(meta.subtitle || ""),
    description: (extra.description as DescriptionMap).en,
    coverKey: meta.coverKey || null,
    assetPageDir: meta.assetPageDir || null,
    readerUrl: meta.readerUrl || null,
    status: meta.status || "published",
    seriesKey: meta.seriesKey || null,
    episodeN: meta.episodeN != null ? Number(meta.episodeN) : null,
    designWidth: Number(config.designWidth || meta.designWidth || 1152),
    designHeight: Number(config.designHeight || meta.designHeight || 1728),
    extraJson: JSON.stringify(extra),
    pages,
  };
}
