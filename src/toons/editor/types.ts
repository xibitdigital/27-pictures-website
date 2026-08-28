/** Records the editor Worker returns. Drafts live in D1, not config.json. */

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

/** Stored as `draft` | `staging` | `published`. The meta form labels published as Public. */
export type ToonStatus = "draft" | "staging" | "published";
export type ToonVisibility = "draft" | "staging" | "public";

export const TOON_VISIBILITY: { value: ToonVisibility; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "staging", label: "Staging" },
  { value: "public", label: "Public" },
];

export function visibilityFromStatus(status?: string | null): ToonVisibility {
  if (status === "published" || status === "public") return "public";
  if (status === "staging") return "staging";
  return "draft";
}

export function statusFromVisibility(visibility: ToonVisibility): ToonStatus {
  if (visibility === "public") return "published";
  if (visibility === "staging") return "staging";
  return "draft";
}

export function visibilityLabel(status?: string | null): string {
  const vis = visibilityFromStatus(status);
  if (vis === "public") return "Public";
  if (vis === "staging") return "Staging";
  return "Draft";
}

export type DescriptionMap = { en: string; it: string; de: string; fr: string };

export function emptyDescriptionMap(): DescriptionMap {
  return { en: "", it: "", de: "", fr: "" };
}

export function parseDescriptionMap(raw: unknown, fallbackEn = ""): DescriptionMap {
  const map = emptyDescriptionMap();
  map.en = fallbackEn;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    for (const lang of ["en", "it", "de", "fr"] as const) {
      if (typeof rec[lang] === "string") map[lang] = rec[lang];
    }
  }
  if (!map.en.trim()) map.en = fallbackEn;
  return map;
}

export function pickDescription(map: DescriptionMap | undefined, lang: string, fallback = ""): string {
  if (!map) return fallback;
  const hit = map[lang as keyof DescriptionMap];
  return (hit && hit.trim()) || map.en.trim() || fallback;
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

export interface SeriesOption {
  key: string;
  title: string;
  tagline?: string;
}

export interface ToonListItem {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  coverUrl: string | null;
  pageCount?: number;
  status?: string;
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
