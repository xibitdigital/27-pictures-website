/**
 * Worker-only types (D1 rows, bindings, JWT).
 * The JSON contract lives in `apiTypes.ts` and is imported by the Vue studio.
 */

import type { DescriptionMap, RegionBorderStyle, RegionGeometry, SeriesGenerateConfig, UserRole } from "./apiTypes";

export type {
  BubbleRecord,
  CaptionLang,
  CreditBucket,
  CreditsSnapshot,
  DescriptionMap,
  EditorUser,
  InviteUserInput,
  InviteUserResult,
  PageRecord,
  RegionBorderStyle,
  RegionGeometry,
  RegionRecord,
  RegionShapeType,
  SeriesGenerateConfig,
  SeriesInput,
  SeriesOption,
  ToonListItem,
  ToonMetaInput,
  ToonRecord,
  ToonStatus,
  UserRole,
} from "./apiTypes";
export { DESC_LANGS, emptyDescriptionMap, parseDescriptionMap, pickDescription } from "./apiTypes";

export interface AiBinding {
  run(
    model: string,
    input: { text: string; source_lang: string; target_lang: string }
  ): Promise<{ translated_text?: string }>;
}

export interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  AI?: AiBinding;
  ALLOWED_ORIGINS?: string;
  ASSET_BASE?: string;
  ALLOWED_TOONS?: string;
  JWT_SECRET?: string;
  ELEVENLABS_API_KEY?: string;
  COMFY_URL?: string;
  COMFY_API_KEY?: string;
  BFL_API_KEY?: string;
  REPLICATE_API_TOKEN?: string;
  /** AES-256-GCM key (base64, 32 raw bytes) for per-user API key encryption — see userKeys.ts. */
  KEYS_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
  FROM_NAME?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export type JsonRecord = Record<string, unknown>;

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

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
  owner_id?: string | null;
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
  kind?: string;
  bg_color?: string | null;
  created_at?: string;
}

export interface RegionRow {
  id: string;
  page_id: string;
  shape_type: string;
  geometry_json: string;
  file_key: string | null;
  file_width: number | null;
  file_height: number | null;
  image_offset_x: number;
  image_offset_y: number;
  image_scale: number;
  border_color: string | null;
  border_width: number;
  border_style: string;
  sort: number;
  created_at?: string;
  updated_at?: string;
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
  owner_id?: string | null;
  editor_ids?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserRow {
  id: string;
  email: string;
  username: string;
  role: UserRole;
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

/** Public shape of one filled region on a `kind: "layout"` page — mirrors
 * `RegionRecord` (apiTypes.ts) minus id/timestamps. Only regions with an
 * assigned image are ever included (see readerConfigFromToon). */
export interface ReaderRegion {
  shapeType: "rect" | "polygon";
  geometry: RegionGeometry;
  file: string;
  fileWidth: number | null;
  fileHeight: number | null;
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  borderColor: string | null;
  borderWidth: number;
  borderStyle: RegionBorderStyle;
  sort: number;
}

export interface ReaderConfig {
  title: string;
  designWidth: number;
  designHeight: number;
  defaultLang: string;
  languages: unknown;
  pages: { file: string; words: CaptionWord[]; kind?: "layout"; regions?: ReaderRegion[] }[];
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
  generate?: Partial<SeriesGenerateConfig> | null;
}

export type CorsHeaders = Record<string, string>;

export type JsonResponse = (body: unknown, status: number, extraHeaders?: CorsHeaders) => Response;
