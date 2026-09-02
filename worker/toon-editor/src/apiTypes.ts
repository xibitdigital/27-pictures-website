/**
 * JSON the toon-editor Worker returns and the Vue studio consumes.
 * No Cloudflare types — safe to import from the site bundle.
 */

export const DESC_LANGS = ["en", "it", "de", "fr"] as const;
export type CaptionLang = (typeof DESC_LANGS)[number];
export type DescriptionMap = Record<CaptionLang, string>;

export type ToonStatus = "draft" | "staging" | "published";

export interface EditorUser {
  id: string;
  email: string;
}

export interface CreditBucket {
  used: number;
  limit: number | null;
  unit: "chars" | "credits";
}

export interface CreditsSnapshot {
  audio: CreditBucket;
  image: CreditBucket;
  periodEnd: string | null;
}

export function emptyDescriptionMap(): DescriptionMap {
  return { en: "", it: "", de: "", fr: "" };
}

export function parseDescriptionMap(raw: unknown, fallbackEn = ""): DescriptionMap {
  const map = emptyDescriptionMap();
  map.en = fallbackEn;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    for (const lang of DESC_LANGS) {
      if (typeof rec[lang] === "string") map[lang] = rec[lang];
    }
  }
  if (!map.en.trim()) map.en = fallbackEn;
  return map;
}

export function pickDescription(map: DescriptionMap | undefined, lang: string, fallback = ""): string {
  if (!map) return fallback;
  const hit = map[lang as CaptionLang];
  return (hit && hit.trim()) || map.en.trim() || fallback;
}

export interface BubbleRecord {
  id: string;
  x: number;
  y: number;
  variant: string;
  tail: string | null;
  size: number | null;
  angle: number | null;
  textEn: string;
  textJson?: string | null;
  extraJson?: string | null;
  sort: number;
}

export interface PageRecord {
  id: string;
  position: number;
  fileKey: string;
  fileUrl: string;
  width: number | null;
  height: number | null;
  bubbles: BubbleRecord[];
}

export interface ToonRecord {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  descriptions?: DescriptionMap;
  coverKey: string | null;
  coverUrl: string | null;
  designWidth: number;
  designHeight: number;
  status?: string;
  readerUrl?: string | null;
  assetPageDir?: string | null;
  seriesKey?: string | null;
  episodeN?: number | null;
  pages: PageRecord[];
}

export type SeriesSlotKind = "sheet" | "previous";

export interface SeriesFlowSlot {
  alias: string;
  label: string;
  kind: SeriesSlotKind;
  fileKey?: string | null;
  fileUrl?: string | null;
}

/** One node input in the uploaded flow that could receive the page prompt. */
export interface PromptCandidate {
  nodeId: string;
  inputKey: string;
  label: string;
  preview: string;
}

export interface PromptTarget {
  nodeId: string;
  inputKey: string;
}

export interface SeriesGenerateConfig {
  width: number | null;
  height: number | null;
  model: string;
  flowKey: string | null;
  flowUrl: string | null;
  slots: SeriesFlowSlot[];
  /** Every literal string input found in the flow — for the series form's picker. */
  promptCandidates: PromptCandidate[];
  /** Which one the typed prompt is written into. Null = legacy behaviour (every Seedream node's `prompt`). */
  promptTarget: PromptTarget | null;
}

export interface SeriesOption {
  key: string;
  title: string;
  tagline?: string;
  coverUrl?: string | null;
  hubUrl?: string | null;
  sort?: number;
  toonCount?: number;
  description?: string;
  descriptions?: DescriptionMap;
  coverKey?: string | null;
  generate?: SeriesGenerateConfig;
}

export interface SeriesInput {
  key: string;
  title: string;
  tagline: string;
  description: string;
  descriptions?: DescriptionMap;
  hubUrl?: string | null;
  sort?: number;
  generate?: Partial<SeriesGenerateConfig> | null;
}

export interface ToonListItem {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  coverUrl: string | null;
  pageCount?: number;
  status?: string;
  seriesKey?: string | null;
  episodeN?: number | null;
}

export interface ToonMetaInput {
  slug?: string;
  title: string;
  subtitle: string;
  description: string;
  descriptions?: DescriptionMap;
  status?: ToonStatus;
  seriesKey?: string | null;
  episodeN?: number | null;
}
