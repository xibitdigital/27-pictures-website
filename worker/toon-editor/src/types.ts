/**
 * Worker-only types (D1 rows, bindings, JWT).
 * The JSON contract lives in `apiTypes.ts` and is imported by the Vue studio.
 */

import type { DescriptionMap } from "./apiTypes";

export type {
  BubbleRecord,
  CaptionLang,
  DescriptionMap,
  EditorUser,
  PageRecord,
  SeriesInput,
  SeriesOption,
  ToonListItem,
  ToonMetaInput,
  ToonRecord,
  ToonStatus,
} from "./apiTypes";
export { DESC_LANGS, emptyDescriptionMap, parseDescriptionMap, pickDescription } from "./apiTypes";

export interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  ALLOWED_ORIGINS?: string;
  ASSET_BASE?: string;
  ALLOWED_TOONS?: string;
  JWT_SECRET?: string;
}

export type JsonRecord = Record<string, unknown>;

export interface RequestLike {
  url: string;
  headers?: { get(name: string): string | null };
}

export interface JwtPayload {
  sub?: string;
  email?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface ToonRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  cover_key: string | null;
  design_width: number;
  design_height: number;
  status?: string;
  reader_url?: string | null;
  asset_page_dir?: string | null;
  extra_json?: string | null;
  series_key?: string | null;
  episode_n?: number | null;
  page_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PageRow {
  id: string;
  toon_id: string;
  position: number;
  file_key: string;
  width: number | null;
  height: number | null;
  created_at?: string;
}

export interface BubbleRow {
  id: string;
  page_id: string;
  x: number;
  y: number;
  variant: string;
  tail: string | null;
  size: number | null;
  angle: number | null;
  text_en: string;
  textEn?: string;
  text_json?: string | null;
  textJson?: string | null;
  extra_json?: string | null;
  extraJson?: string | null;
  sort: number;
  created_at?: string;
  updated_at?: string;
}

export interface SeriesRow {
  key: string;
  title: string;
  tagline: string;
  description: string;
  cover_key: string | null;
  hub_url: string | null;
  sort: number;
  extra_json?: string | null;
  toon_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash?: string;
}

export interface CaptionWord {
  x: number;
  y: number;
  variant: string;
  text: Record<string, string>;
  tail?: string;
  size?: number | null;
  angle?: number | null;
  audio?: string;
  [key: string]: unknown;
}

export interface WordInput {
  x?: unknown;
  y?: unknown;
  variant?: unknown;
  tail?: unknown;
  size?: unknown;
  angle?: unknown;
  text?: unknown;
  [key: string]: unknown;
}

export interface WordRow {
  x: number;
  y: number;
  variant: string;
  tail: string | null;
  size: number | null;
  angle: number | null;
  textEn: string;
  textJson: string;
  extraJson: string | null;
  sort: number;
}

export interface ImportMeta {
  slug?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  descriptions?: Partial<DescriptionMap> | Record<string, unknown>;
  titles?: Record<string, unknown>;
  coverKey?: string | null;
  assetPageDir?: string | null;
  readerUrl?: string | null;
  status?: string;
  seriesKey?: string | null;
  episodeN?: number | null;
  designWidth?: number;
  designHeight?: string | number;
}

export interface ReaderConfig {
  title: string;
  designWidth: number;
  designHeight: number;
  defaultLang: string;
  languages: unknown;
  pages: { file: string; words: CaptionWord[] }[];
  reverb?: unknown;
}

export interface SeriesMeta {
  key?: string;
  title?: string;
  tagline?: string;
  description?: string;
  descriptions?: Partial<DescriptionMap> | Record<string, unknown>;
  coverKey?: string | null;
  hubUrl?: string | null;
  sort?: number;
}

export type CorsHeaders = Record<string, string>;

export type JsonResponse = (body: unknown, status: number, extraHeaders?: CorsHeaders) => Response;
