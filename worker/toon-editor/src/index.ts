/**
 * Toon editor API — D1 drafts + R2 plates/covers.
 *
 * Public: CORS preflight, GET /media/editor/…, GET /auth/status,
 * GET /catalog, GET /sitemap.xml, GET /config/:slug (Public + Staging; Draft never),
 * GET /resolve-reader (Staging-only path lookup for unlisted production URLs), GET/POST /likes,
 * POST /auth/login, POST /auth/register (first account only).
 * Everything else needs a JWT: Authorization: Bearer <login token>.
 */
import {
  generatePassword,
  hashPassword,
  issueToken,
  normaliseEmail,
  publicUser,
  userCount,
  userFromRequest,
  validateCredentials,
  validateEmail,
  verifyPassword,
} from "./auth";
import { mergeGenerate, parseComfyApiGraph, parseGenerateConfig, slugAlias } from "./comfyFlow";
import { insertCreditEvent, loadUserCredits } from "./creditUsage";
import { pollPageJob, recordImageCredit, startPageGenerate, type GenerationJob } from "./generatePage";
import { generateClip, parseGenerateAudioBody } from "./elevenlabs";
import { configToImport, descriptionMapFromMeta, rowToWord } from "./importConfig";
import { toWebp } from "./imageOptimize";
import { sendInviteEmail } from "./inviteEmail";
import { verifyTurnstile } from "./turnstile";
import { handleLikes } from "./likes";
import { canManageSeries, canManageToon, isAdmin, publishError } from "./roles";
import { isMethod } from "./httpMethod";
import { isReaderLookupPath, readerStatuses, toonMatchesReaderPath } from "./readerLookup";
import { parseStatus, publicStatusesForRequest } from "./visibility";
import { renderSitemapXml, siteOriginFromRequest, staticSitemapUrls, toonSitemapUrls } from "./sitemap";

import {
  DESC_LANGS,
  type BubbleRecord,
  type BubbleRow,
  type CaptionWord,
  type CorsHeaders,
  type DescriptionMap,
  type EditorUser,
  type Env,
  type JsonRecord,
  type PageRecord,
  type PageRow,
  type ReaderConfig,
  type RequestLike,
  type SeriesMeta,
  type SeriesOption,
  type SeriesRow,
  type ToonListItem,
  type ToonRecord,
  type ToonRow,
  type UserRole,
  type UserRow,
  type WordInput,
} from "./types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Raw PNG character sheets (uncompressed, high-res) routinely land well past
// 8MB — that limit rejected legitimate reference uploads.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
};

/**
 * Fallback for browsers/OSes that hand us an empty or wrong `File.type` for a
 * perfectly valid image (seen with some PNGs) — checked only when the
 * declared MIME type isn't one of IMAGE_TYPES.
 */
function sniffImageType(bytes: ArrayBuffer): { ext: string; type: string } | null {
  const u = new Uint8Array(bytes.slice(0, 12));
  if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return { ext: "png", type: "image/png" };
  if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x45)
    return { ext: "webp", type: "image/webp" };
  return null;
}

function resolveImageType(declaredType: string, bytes: ArrayBuffer): { ext: string; type: string } | null {
  const ext = IMAGE_TYPES[declaredType];
  if (ext) return { ext, type: declaredType };
  return sniffImageType(bytes);
}

type ImageUpload = {
  bytes: ArrayBuffer;
  ext: string;
  type: string;
  width: number | null;
  height: number | null;
};

type AudioUpload = {
  bytes: ArrayBuffer;
  ext: string;
  type: string;
};
const DEFAULT_VARIANT = "bubble";
const DEFAULT_TAIL = "bottom-left";

function isDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|local\.twentyseven\.test)(:\d+)?$/.test(origin);
}

function allowedOriginList(env: Env): string[] {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request, env: Env): CorsHeaders {
  const origin = request.headers.get("Origin") || "";
  const headers: CorsHeaders = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowedOriginList(env).includes(origin) || isDevOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function xml(body: string, extraHeaders?: CorsHeaders): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      ...extraHeaders,
    },
  });
}

function json(body: unknown, status: number, extraHeaders?: CorsHeaders): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

function isPublicConfigPath(path: string): boolean {
  return /^\/config\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path);
}

function isPublicRoute(method: string, path: string): boolean {
  if (isMethod(method, "GET") && path.startsWith("/media/")) return true;
  if (isMethod(method, "GET") && path === "/auth/status") return true;
  if (isMethod(method, "GET") && path === "/catalog") return true;
  if (isMethod(method, "GET") && path === "/sitemap.xml") return true;
  if (isMethod(method, "GET") && path === "/resolve-reader") return true;
  if (isMethod(method, "GET") && isPublicConfigPath(path)) return true;
  if (path === "/likes" && (isMethod(method, "GET") || isMethod(method, "POST"))) return true;
  if (isMethod(method, "POST") && (path === "/auth/login" || path === "/auth/register")) return true;
  return false;
}

/** Listed production origins may POST a like. Dev hosts may only GET counts. */
function isWriteOrigin(request: Request, env: Env): boolean {
  return allowedOriginList(env).includes(request.headers.get("Origin") || "");
}

async function readJson(request: Request): Promise<{ ok: true; body: JsonRecord } | { ok: false; error: string }> {
  try {
    return { ok: true, body: (await request.json()) as JsonRecord };
  } catch {
    return { ok: false, error: "invalid json" };
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function mediaUrl(request: RequestLike, key: string | null | undefined): string | null {
  if (!key) return null;
  const origin = new URL(request.url).origin;
  return `${origin}/media/${key}`;
}

function objectUrl(
  request: RequestLike,
  env: Env,
  key: string | null | undefined,
  pageDir: string | null | undefined
): string | null {
  if (!key) return null;
  if (String(key).startsWith("editor/")) return mediaUrl(request, key);
  const base = String(env.ASSET_BASE || "").replace(/\/$/, "");
  if (key.startsWith("card-art/") || key.startsWith("toons/")) {
    return base ? `${base}/${key}` : `/${key}`;
  }
  const dir = String(pageDir || "").replace(/\/?$/, "/");
  const rel = String(key).replace(/^\//, "");
  return base ? `${base}${dir}${rel}` : `${dir}${rel}`;
}

function mapBubble(row: BubbleRow | Record<string, unknown>): BubbleRecord {
  const r = row as BubbleRow;
  return {
    id: r.id,
    x: r.x,
    y: r.y,
    variant: r.variant,
    tail: r.tail,
    size: r.size,
    angle: r.angle,
    textEn: r.text_en,
    textJson: r.text_json || null,
    extraJson: r.extra_json || null,
    sort: r.sort,
  };
}

function mapPage(
  row: PageRow | Record<string, unknown>,
  request: RequestLike,
  env: Env,
  pageDir: string | null | undefined,
  bubbles: BubbleRecord[]
): PageRecord {
  row = row as PageRow;
  return {
    id: row.id,
    position: row.position,
    fileKey: row.file_key,
    fileUrl: objectUrl(request, env, row.file_key, pageDir) || "",
    width: row.width,
    height: row.height,
    bubbles: bubbles || [],
  };
}

function mapToon(
  row: ToonRow | Record<string, unknown>,
  request: RequestLike,
  env: Env,
  pages: PageRecord[]
): ToonRecord {
  row = row as ToonRow;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    descriptions: descriptionMap(row),
    coverKey: row.cover_key,
    coverUrl: objectUrl(request, env, row.cover_key, row.asset_page_dir),
    designWidth: row.design_width,
    designHeight: row.design_height,
    status: row.status || "draft",
    readerUrl: row.reader_url || null,
    assetPageDir: row.asset_page_dir || null,
    seriesKey: row.series_key || null,
    episodeN: row.episode_n != null ? Number(row.episode_n) : null,
    ownerId: row.owner_id || null,
    pages: pages || [],
  };
}

function mapToonListItem(row: ToonRow | Record<string, unknown>, request: RequestLike, env: Env): ToonListItem {
  row = row as ToonRow;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    coverUrl: objectUrl(request, env, row.cover_key, row.asset_page_dir),
    pageCount: Number(row.page_count) || 0,
    status: row.status || "draft",
    readerUrl: row.reader_url || null,
    seriesKey: row.series_key || null,
    episodeN: row.episode_n != null ? Number(row.episode_n) : null,
    ownerId: row.owner_id || null,
  };
}

function mapCatalogEpisode(row: ToonRow | Record<string, unknown>, request: RequestLike, env: Env) {
  const t = row as ToonRow & { page_count?: number };
  const descriptions = descriptionMap(t);
  const titles = titleMap(t);
  return {
    id: t.slug,
    slug: t.slug,
    title: titles.en || t.title,
    titles,
    subtitle: t.subtitle,
    description: descriptions.en,
    descriptions,
    coverUrl: objectUrl(request, env, t.cover_key, t.asset_page_dir),
    pageCount: Number(t.page_count) || 0,
    readerUrl: t.reader_url || null,
    n: t.episode_n,
    assetPageDir: t.asset_page_dir || `/toons/${t.slug}/`,
    designWidth: t.design_width,
    designHeight: t.design_height,
  };
}

function seriesGenerate(row: SeriesRow, request: RequestLike, env: Env): SeriesOption["generate"] {
  const extra = parseToonExtra(row);
  const generate = parseGenerateConfig(extra.generate);
  generate.flowUrl = objectUrl(request, env, generate.flowKey, null);
  generate.slots = generate.slots.map((slot) => ({
    ...slot,
    fileUrl: slot.fileKey ? objectUrl(request, env, slot.fileKey, null) : null,
  }));
  return generate;
}

function mapSeries(row: SeriesRow | Record<string, unknown> | null, request: RequestLike, env: Env): SeriesOption {
  if (!row) throw new Error("missing series");
  row = row as SeriesRow;
  const descriptions = descriptionMap(row);
  return {
    key: row.key,
    title: row.title,
    tagline: row.tagline || "",
    description: descriptions.en || row.description || "",
    descriptions,
    coverKey: row.cover_key || null,
    coverUrl: objectUrl(request, env, row.cover_key, null),
    hubUrl: row.hub_url || null,
    sort: Number(row.sort) || 0,
    toonCount: Number(row.toon_count) || 0,
    generate: seriesGenerate(row, request, env),
    ownerId: row.owner_id || null,
    editorIds: row.editor_ids ? String(row.editor_ids).split(",") : [],
  };
}

function parseSeriesKey(body: JsonRecord | null | undefined, fallback: string | null) {
  if (!body || (!("seriesKey" in body) && !("series_key" in body))) return fallback;
  const raw = String(body.seriesKey ?? body.series_key ?? "").trim();
  return raw || null;
}

function parseEpisodeN(body: JsonRecord | null | undefined, fallback: number | null) {
  if (!body || (!("episodeN" in body) && !("episode_n" in body))) return fallback;
  const n = Number(body.episodeN ?? body.episode_n);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

/**
 * The editor's toon form has no Reader URL field — a toon created under a
 * series without one silently sits at the orphan /toons/<slug>/ instead of
 * nesting under its series hub. Derive it from the series hub_url so every
 * episode gets the same URL shape as its siblings without anyone typing it.
 */
async function deriveReaderUrl(env: Pick<Env, "DB">, seriesKey: string | null, slug: string): Promise<string | null> {
  if (!seriesKey) return null;
  const series = await env.DB.prepare("SELECT hub_url FROM series WHERE key = ?")
    .bind(seriesKey)
    .first<{ hub_url: string | null }>();
  if (!series?.hub_url) return null;
  return `${series.hub_url.replace(/\/*$/, "/")}${slug}/`;
}

function wordFromBubble(b: BubbleRow): CaptionWord {
  return rowToWord(b);
}

/** FlipFrame readers resolve relative paths on the CDN; editor clips live on this Worker. */
function publicWord(request: RequestLike, word: CaptionWord): CaptionWord {
  const audio = word && word.audio;
  if (typeof audio === "string" && audio.startsWith("editor/")) {
    return { ...word, audio: mediaUrl(request, audio) || audio };
  }
  return word;
}

/**
 * A plate uploaded through the editor lives under the `editor/` R2 prefix,
 * proxied through this Worker's own /media route — not the public CDN the
 * reader otherwise resolves `pages[].file` against via asset-page-dir. Turn
 * it into the absolute /media/ URL so resolveAssetUrl() passes it through
 * instead of joining it onto the CDN base as if it were CDN-relative.
 */
function publicPageFile(request: RequestLike, fileKey: string): string {
  if (fileKey.startsWith("editor/")) return mediaUrl(request, fileKey) || fileKey;
  return fileKey;
}

function parseToonExtra(toon: { extra_json?: string | null } | null | undefined): JsonRecord {
  if (!toon || !toon.extra_json) return {};
  try {
    const extra = JSON.parse(toon.extra_json);
    return extra && typeof extra === "object" && !Array.isArray(extra) ? (extra as JsonRecord) : {};
  } catch {
    return {};
  }
}

function langMap(row: Record<string, unknown>, extraKey: string, column: string): DescriptionMap {
  const extra = parseToonExtra(row);
  const raw = extra[extraKey];
  const map: DescriptionMap = { en: String(row[column] || ""), it: "", de: "", fr: "" };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as JsonRecord;
    for (const lang of DESC_LANGS) {
      if (typeof rec[lang] === "string") map[lang] = rec[lang];
    }
  }
  if (!String(map.en || "").trim()) map.en = String(row[column] || "");
  return map;
}

function descriptionMap(row: object): DescriptionMap {
  return langMap(row as Record<string, unknown>, "description", "description");
}

function titleMap(row: object): DescriptionMap {
  return langMap(row as Record<string, unknown>, "title", "title");
}

function asMap(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function applyDescriptions(extra: JsonRecord, body: JsonRecord, enFallback: string): DescriptionMap {
  const current = asMap(extra.description);
  const incoming = body.descriptions && typeof body.descriptions === "object" ? asMap(body.descriptions) : null;
  const map: DescriptionMap = { en: "", it: "", de: "", fr: "" };
  for (const lang of DESC_LANGS) {
    if (incoming && incoming[lang] != null) map[lang] = String(incoming[lang]).trim();
    else if (lang === "en" && body.description != null) map.en = String(body.description).trim();
    else map[lang] = String(current[lang] || (lang === "en" ? enFallback : "") || "").trim();
  }
  extra.description = map;
  return map;
}

function applyTitles(extra: JsonRecord, body: JsonRecord, enFallback: string): DescriptionMap | null {
  const incoming = body.titles && typeof body.titles === "object" ? asMap(body.titles) : null;
  if (!incoming) return extra.title ? (asMap(extra.title) as DescriptionMap) : null;
  const current = asMap(extra.title);
  const map: DescriptionMap = { en: "", it: "", de: "", fr: "" };
  for (const lang of DESC_LANGS) {
    if (incoming[lang] != null) map[lang] = String(incoming[lang]).trim();
    else map[lang] = String(current[lang] || (lang === "en" ? enFallback : "") || "").trim();
  }
  extra.title = map;
  return map;
}

async function upsertSeries(
  env: Env,
  seriesMeta: SeriesMeta | null | undefined,
  ts: string,
  ownerId: string | null = null
) {
  if (!seriesMeta || !seriesMeta.key) return;
  const skey = String(seriesMeta.key);
  const found = await env.DB.prepare("SELECT * FROM series WHERE key = ?").bind(skey).first<SeriesRow>();
  const extra: JsonRecord = parseToonExtra(found);
  extra.description = descriptionMapFromMeta(seriesMeta);
  const currentGenerate = parseGenerateConfig(extra.generate);
  extra.generate =
    seriesMeta.generate !== undefined ? mergeGenerate(currentGenerate, seriesMeta.generate) : currentGenerate;
  const extraJson = JSON.stringify(extra);
  const description = descriptionMapFromMeta(seriesMeta).en || String(seriesMeta.description || "");
  const coverKey = seriesMeta.coverKey !== undefined ? seriesMeta.coverKey || null : (found && found.cover_key) || null;
  const hubUrl =
    seriesMeta.hubUrl !== undefined
      ? normaliseHubUrl(seriesMeta.hubUrl) || `/toons/${skey}/`
      : found
        ? found.hub_url
        : null;
  if (found) {
    await env.DB.prepare(
      `UPDATE series SET title = ?, tagline = ?, description = ?, cover_key = ?, hub_url = ?, sort = ?, extra_json = ?, updated_at = ?
       WHERE key = ?`
    )
      .bind(
        String(seriesMeta.title || ""),
        String(seriesMeta.tagline || ""),
        description,
        coverKey,
        hubUrl,
        Number(seriesMeta.sort) || 0,
        extraJson,
        ts,
        skey
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO series (key, title, tagline, description, cover_key, hub_url, sort, extra_json, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        skey,
        String(seriesMeta.title || ""),
        String(seriesMeta.tagline || ""),
        description,
        coverKey,
        hubUrl,
        Number(seriesMeta.sort) || 0,
        extraJson,
        ownerId,
        ts,
        ts
      )
      .run();
  }
}

async function isSeriesEditor(env: Env, seriesKey: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  const row = await env.DB.prepare("SELECT 1 FROM series_editors WHERE series_key = ? AND user_id = ? LIMIT 1")
    .bind(seriesKey, userId)
    .first();
  return Boolean(row);
}

async function syncSeriesEditors(env: Env, seriesKey: string, editorIds: string[]): Promise<void> {
  await env.DB.prepare("DELETE FROM series_editors WHERE series_key = ?").bind(seriesKey).run();
  const ts = nowIso();
  for (const id of editorIds) {
    await env.DB.prepare("INSERT INTO series_editors (series_key, user_id, created_at) VALUES (?, ?, ?)")
      .bind(seriesKey, id, ts)
      .run();
  }
}

/** One round-trip for every caption on a toon — N+1 per page is seconds on Miniflare. */
async function bubblesByPageId(env: Pick<Env, "DB">, toonId: string): Promise<Map<string, BubbleRow[]>> {
  const rows = (
    await env.DB.prepare(
      `SELECT bubbles.* FROM bubbles
       INNER JOIN pages ON pages.id = bubbles.page_id
       WHERE pages.toon_id = ?
       ORDER BY pages.position ASC, bubbles.sort ASC, bubbles.created_at ASC`
    )
      .bind(toonId)
      .all<BubbleRow>()
  ).results;
  const map = new Map<string, BubbleRow[]>();
  for (const row of rows) {
    const list = map.get(row.page_id);
    if (list) list.push(row);
    else map.set(row.page_id, [row]);
  }
  return map;
}

async function readerConfigFromToon(env: Pick<Env, "DB">, toon: ToonRow, request: RequestLike): Promise<ReaderConfig> {
  const extra = parseToonExtra(toon);
  const pageRows = (
    await env.DB.prepare("SELECT * FROM pages WHERE toon_id = ? ORDER BY position ASC").bind(toon.id).all<PageRow>()
  ).results;
  const bubbles = await bubblesByPageId(env, toon.id);
  const pages: ReaderConfig["pages"] = pageRows.map((page) => ({
    file: publicPageFile(request, page.file_key),
    words: (bubbles.get(page.id) ?? []).map((row) => publicWord(request, wordFromBubble(row))),
  }));
  const cfg: ReaderConfig = {
    title: toon.title,
    designWidth: toon.design_width,
    designHeight: toon.design_height,
    defaultLang: String(extra.defaultLang || "en"),
    languages: extra.languages || [{ code: "en", label: "EN" }],
    pages,
  };
  if (extra.reverb) cfg.reverb = extra.reverb;
  return cfg;
}

function clamp01(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function normaliseSlug(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normaliseHubUrl(raw: unknown): string | null {
  const segments = String(raw || "")
    .trim()
    .split("/")
    .map((segment) => normaliseSlug(segment))
    .filter(Boolean);
  if (!segments.length) return null;
  return `/${segments.join("/")}/`;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadToon(env: Env, request: Request, id: string) {
  const toon = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first<ToonRow>();
  if (!toon) return null;
  const pageRows = (
    await env.DB.prepare("SELECT * FROM pages WHERE toon_id = ? ORDER BY position ASC").bind(id).all<PageRow>()
  ).results;
  const bubbles = await bubblesByPageId(env, id);
  const pages = pageRows.map((page) =>
    mapPage(page, request, env, toon.asset_page_dir, (bubbles.get(page.id) ?? []).map(mapBubble))
  );
  return mapToon(toon, request, env, pages);
}

async function getPageOrNull(env: Env, pageId: string) {
  return env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(pageId).first<PageRow>();
}

async function putImage(env: Env, key: string, bytes: ArrayBuffer, contentType: string) {
  await env.ASSETS.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
}

async function putPageAsset(env: Env, slug: string, upload: ImageUpload) {
  const hash = await sha256Hex(upload.bytes);
  const key = `editor/${slug}/assets/${hash}.${upload.ext}`;
  await putImage(env, key, upload.bytes, upload.type);
  return key;
}

async function putCaptionAudio(env: Env, slug: string, bytes: ArrayBuffer): Promise<string> {
  const hash = await sha256Hex(bytes);
  const key = `editor/${slug}/sfx/${hash}.mp3`;
  await putImage(env, key, bytes, "audio/mpeg");
  return key;
}

async function readUpload(request: Request): Promise<ImageUpload | { error: string }> {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return { error: "file is required" };
  }
  const blob = file as File;
  const bytes = await blob.arrayBuffer();
  const resolved = resolveImageType(blob.type || "", bytes);
  if (!resolved) return { error: "image must be webp, jpeg, or png" };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { error: "image too large (20MB max)" };
  const widthRaw = form.get("width") != null ? Number(form.get("width")) : NaN;
  const heightRaw = form.get("height") != null ? Number(form.get("height")) : NaN;
  return {
    bytes,
    ext: resolved.ext,
    type: resolved.type,
    width: Number.isFinite(widthRaw) && widthRaw > 0 ? Math.round(widthRaw) : null,
    height: Number.isFinite(heightRaw) && heightRaw > 0 ? Math.round(heightRaw) : null,
  };
}

function audioExtFromName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .endsWith(".mp3")
    ? "mp3"
    : "";
}

async function readAudioUpload(request: Request): Promise<AudioUpload | { error: string }> {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return { error: "file is required" };
  }
  const blob = file as File;
  const ext = AUDIO_TYPES[blob.type] || audioExtFromName(blob.name);
  if (!ext) return { error: "audio must be mp3" };
  const bytes = await blob.arrayBuffer();
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { error: "audio too large (20MB max)" };
  const type = "audio/mpeg";
  return { bytes, ext, type };
}

async function handle(request: Request, env: Env, cors: CorsHeaders, session: EditorUser | null): Promise<Response> {
  const likes = await handleLikes(request, env, cors, json, isWriteOrigin);
  if (likes) return likes;

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = request.method;

  if (isMethod(method, "GET") && path === "/auth/status") {
    return json({ hasUsers: (await userCount(env)) > 0 }, 200, cors);
  }

  if (isMethod(method, "POST") && path === "/auth/register") {
    if ((await userCount(env)) > 0) return json({ error: "registration closed" }, 403, cors);
    const parsed = await readJson(request);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
    const email = normaliseEmail(parsed.body.email);
    const password = String(parsed.body.password || "");
    const invalid = validateCredentials(email, password);
    if (invalid) return json({ error: invalid }, 400, cors);
    const id = crypto.randomUUID();
    const ts = nowIso();
    // The very first account ever created is the site owner setting the
    // studio up — it bootstraps as admin, same as every pre-existing row did
    // in migration 0009. Username has no form field here; derive it like the
    // migration's backfill so the column is never left empty.
    const username = email.split("@")[0] || email;
    await env.DB.prepare(
      `INSERT INTO users (id, email, username, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, email, username, "admin", await hashPassword(password), ts)
      .run();
    const user: EditorUser = { id, email, username, role: "admin" };
    const sess = await issueToken(env, user);
    return json({ token: sess.token, user: publicUser(user) }, 201, cors);
  }

  if (isMethod(method, "POST") && path === "/auth/login") {
    const parsed = await readJson(request);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
    const email = normaliseEmail(parsed.body.email);
    const password = String(parsed.body.password || "");
    const row = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
    if (!row || !row.password_hash || !(await verifyPassword(password, row.password_hash))) {
      return json({ error: "invalid email or password" }, 401, cors);
    }
    const user: EditorUser = { id: row.id, email: row.email, username: row.username, role: row.role };
    const sess = await issueToken(env, user);
    return json({ token: sess.token, user: publicUser(user) }, 200, cors);
  }

  if (isMethod(method, "GET") && path === "/auth/me") {
    if (!session) return json({ error: "unauthorized" }, 401, cors);
    return json({ user: publicUser(session) }, 200, cors);
  }

  if (isMethod(method, "GET") && path === "/credits") {
    if (!session) return json({ error: "unauthorized" }, 401, cors);
    return json(await loadUserCredits(env, session.id), 200, cors);
  }

  const jobMatch = path.match(/^\/jobs\/([^/]+)$/);
  if (isMethod(method, "GET") && jobMatch) {
    const job = await env.DB.prepare("SELECT * FROM generation_jobs WHERE id = ?")
      .bind(jobMatch[1])
      .first<GenerationJob>();
    if (!job) return json({ error: "not found" }, 404, cors);
    const toon = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(job.toon_id).first<ToonRow>();
    if (!toon) return json({ error: "not found" }, 404, cors);
    const polled = job.status === "running" ? await pollPageJob(env, job, toon) : { ok: true as const, job };
    if (!polled.ok) return json({ error: polled.error }, polled.status, cors);
    if (polled.job.status === "done" && job.status !== "done" && session) {
      try {
        await recordImageCredit(env, session.id);
      } catch {
        /* credit row is secondary */
      }
    }
    const body: JsonRecord = {
      ...polled.job,
      id: polled.job.id,
      status: polled.job.status,
      error: polled.job.error,
      resultPageId: polled.job.result_page_id,
    };
    if (polled.job.status === "done") {
      body.toon = await loadToon(env, request, toon.id);
    }
    return json(body, 200, cors);
  }

  if (isMethod(method, "POST") && path === "/auth/logout") {
    return json({ ok: true }, 200, cors);
  }

  if (isMethod(method, "POST") && path === "/auth/users") {
    if (!session || !isAdmin(session)) return json({ error: "forbidden" }, 403, cors);
    const parsed = await readJson(request);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
    const turnstileToken = String(parsed.body.turnstileToken || "");
    const turnstileOk = await verifyTurnstile(env, turnstileToken, request.headers.get("CF-Connecting-IP"));
    if (!turnstileOk) return json({ error: "verification failed" }, 400, cors);
    const email = normaliseEmail(parsed.body.email);
    const username = String(parsed.body.username || "").trim();
    const role: UserRole = parsed.body.role === "admin" ? "admin" : "editor";
    const invalid = validateEmail(email);
    if (invalid) return json({ error: invalid }, 400, cors);
    if (!username || username.length > 64) return json({ error: "username is required" }, 400, cors);
    const existingEmail = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existingEmail) return json({ error: "email taken" }, 409, cors);
    const existingUsername = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (existingUsername) return json({ error: "username taken" }, 409, cors);
    const id = crypto.randomUUID();
    const password = generatePassword();
    await env.DB.prepare(
      `INSERT INTO users (id, email, username, role, password_hash, invited_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, email, username, role, await hashPassword(password), session.id, nowIso())
      .run();
    const origin = request.headers.get("Origin") || siteOriginFromRequest(request);
    const loginUrl = `${origin}/toons/editor/`;
    const emailSent = await sendInviteEmail(env, { to: email, username, password, loginUrl });
    return json({ user: publicUser({ id, email, username, role }), emailSent }, 201, cors);
  }

  if (isMethod(method, "GET") && path === "/users") {
    if (!session || !isAdmin(session)) return json({ error: "forbidden" }, 403, cors);
    const rows = (await env.DB.prepare("SELECT id, email, username, role FROM users ORDER BY username").all<UserRow>())
      .results;
    return json({ users: rows.map((row) => publicUser(row)) }, 200, cors);
  }

  const mediaMatch = path.match(/^\/media\/(.+)$/);
  if (isMethod(method, "GET") && mediaMatch) {
    const key = mediaMatch[1];
    if (!key.startsWith("editor/")) return json({ error: "not found" }, 404, cors);
    const obj = await env.ASSETS.get(key);
    if (!obj) return json({ error: "not found" }, 404, cors);
    const headers = new Headers(cors);
    headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(obj.body, { status: 200, headers });
  }

  const publicConfigMatch = path.match(/^\/config\/([^/]+)$/);
  if (isMethod(method, "GET") && publicConfigMatch) {
    const slug = publicConfigMatch[1];
    if (!SLUG_RE.test(slug)) return json({ error: "not found" }, 404, cors);
    const statuses = readerStatuses();
    const toon = await env.DB.prepare(
      `SELECT * FROM toons WHERE slug = ? AND status IN (${statuses.map(() => "?").join(",")})`
    )
      .bind(slug, ...statuses)
      .first<ToonRow>();
    if (!toon) return json({ error: "not found" }, 404, cors);
    return json(await readerConfigFromToon(env, toon, request), 200, cors);
  }

  if (isMethod(method, "GET") && path === "/resolve-reader") {
    let rawPath = "";
    try {
      rawPath = new URL(request.url).searchParams.get("path") || "";
    } catch {
      rawPath = "";
    }
    if (!isReaderLookupPath(rawPath)) return json({ error: "not found" }, 404, cors);
    const rows = (
      await env.DB.prepare(
        `SELECT toons.*,
                (SELECT COUNT(*) FROM pages WHERE pages.toon_id = toons.id) AS page_count
         FROM toons WHERE status = 'staging'`
      ).all<ToonRow & { page_count?: number }>()
    ).results;
    const hit = rows.find((row) => toonMatchesReaderPath(row, rawPath));
    if (!hit) return json({ error: "not found" }, 404, cors);
    const episode = mapCatalogEpisode(hit, request, env);
    let series = null;
    if (hit.series_key) {
      const seriesRow = await env.DB.prepare("SELECT * FROM series WHERE key = ?")
        .bind(hit.series_key)
        .first<SeriesRow>();
      if (seriesRow) {
        const descriptions = descriptionMap(seriesRow);
        series = {
          key: seriesRow.key,
          title: seriesRow.title,
          tagline: seriesRow.tagline,
          description: descriptions.en || seriesRow.description,
          descriptions,
          coverUrl: objectUrl(request, env, seriesRow.cover_key, null),
          hubUrl: seriesRow.hub_url || null,
          episodes: [episode],
        };
      }
    }
    return json({ episode, series }, 200, cors);
  }

  if (isMethod(method, "GET") && path === "/series") {
    const seriesListSql = `SELECT series.*,
                (SELECT COUNT(*) FROM toons WHERE toons.series_key = series.key) AS toon_count,
                (SELECT group_concat(user_id) FROM series_editors WHERE series_editors.series_key = series.key) AS editor_ids
         FROM series
         ${isAdmin(session) ? "" : "WHERE key IN (SELECT series_key FROM series_editors WHERE user_id = ?)"}
         ORDER BY sort ASC, title ASC`;
    const stmt = isAdmin(session)
      ? env.DB.prepare(seriesListSql)
      : env.DB.prepare(seriesListSql).bind(session ? session.id : "");
    const rows = (await stmt.all()).results;
    return json({ series: rows.map((row) => mapSeries(row, request, env)) }, 200, cors);
  }

  const seriesCoverMatch = path.match(/^\/series\/([^/]+)\/cover$/);
  if (isMethod(method, "POST") && seriesCoverMatch) {
    const key = seriesCoverMatch[1];
    if (!SLUG_RE.test(key)) return json({ error: "not found" }, 404, cors);
    const current = await env.DB.prepare("SELECT * FROM series WHERE key = ?").bind(key).first<SeriesRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    const upload = await readUpload(request);
    if ("error" in upload) return json({ error: upload.error }, 400, cors);
    const optimized = await toWebp(upload);
    const hash = await sha256Hex(optimized.bytes);
    const objectKey = `editor/_series/${key}/cover/${hash}.${optimized.ext}`;
    await putImage(env, objectKey, optimized.bytes, optimized.type);
    await env.DB.prepare(`UPDATE series SET cover_key = ?, updated_at = ? WHERE key = ?`)
      .bind(objectKey, nowIso(), key)
      .run();
    const row = await env.DB.prepare(
      `SELECT series.*,
              (SELECT COUNT(*) FROM toons WHERE toons.series_key = series.key) AS toon_count,
              (SELECT group_concat(user_id) FROM series_editors WHERE series_editors.series_key = series.key) AS editor_ids
       FROM series WHERE key = ?`
    )
      .bind(key)
      .first();
    return json(mapSeries(row, request, env), 200, cors);
  }

  const seriesFlowMatch = path.match(/^\/series\/([^/]+)\/flow$/);
  if (isMethod(method, "POST") && seriesFlowMatch) {
    const key = seriesFlowMatch[1];
    if (!SLUG_RE.test(key)) return json({ error: "not found" }, 404, cors);
    const current = await env.DB.prepare("SELECT * FROM series WHERE key = ?").bind(key).first<SeriesRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return json({ error: "file is required" }, 400, cors);
    const blob = file as File;
    const name = String(blob.name || "").toLowerCase();
    const type = blob.type || "";
    if (type && type !== "application/json" && type !== "text/plain" && !name.endsWith(".json")) {
      return json({ error: "flow must be a Comfy API .json" }, 400, cors);
    }
    const bytes = await blob.arrayBuffer();
    if (bytes.byteLength > MAX_UPLOAD_BYTES) return json({ error: "flow too large (20MB max)" }, 400, cors);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return json({ error: "flow is not valid JSON" }, 400, cors);
    }
    const graph = parseComfyApiGraph(parsedJson);
    if (!graph.ok) return json({ error: graph.error }, 400, cors);
    const hash = await sha256Hex(bytes);
    const objectKey = `editor/_series/${key}/flow/${hash}.json`;
    await putImage(env, objectKey, bytes, "application/json");
    const extra = parseToonExtra(current);
    const currentGenerate = parseGenerateConfig(extra.generate);
    // Keep the chosen target only if the new graph still has that exact node
    // input — a re-uploaded flow can renumber or drop nodes entirely.
    const target = currentGenerate.promptTarget;
    const targetStillValid =
      target && graph.promptCandidates.some((c) => c.nodeId === target.nodeId && c.inputKey === target.inputKey);
    extra.generate = mergeGenerate(currentGenerate, {
      width: currentGenerate.width,
      height: currentGenerate.height,
      model: currentGenerate.model || graph.model,
      flowKey: objectKey,
      slots: graph.slots,
      promptCandidates: graph.promptCandidates,
      promptTarget: targetStillValid ? target : null,
    });
    await env.DB.prepare(`UPDATE series SET extra_json = ?, updated_at = ? WHERE key = ?`)
      .bind(JSON.stringify(extra), nowIso(), key)
      .run();
    const row = await env.DB.prepare(
      `SELECT series.*,
              (SELECT COUNT(*) FROM toons WHERE toons.series_key = series.key) AS toon_count,
              (SELECT group_concat(user_id) FROM series_editors WHERE series_editors.series_key = series.key) AS editor_ids
       FROM series WHERE key = ?`
    )
      .bind(key)
      .first();
    return json(mapSeries(row, request, env), 200, cors);
  }

  const seriesRefMatch = path.match(/^\/series\/([^/]+)\/refs$/);
  if (isMethod(method, "POST") && seriesRefMatch) {
    const key = seriesRefMatch[1];
    if (!SLUG_RE.test(key)) return json({ error: "not found" }, 404, cors);
    const current = await env.DB.prepare("SELECT * FROM series WHERE key = ?").bind(key).first<SeriesRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    const form = await request.formData();
    const alias = slugAlias(String(form.get("alias") || ""), "");
    if (!alias || alias === "previous") return json({ error: "alias is required" }, 400, cors);
    const file = form.get("file");
    if (!file || typeof file === "string") return json({ error: "file is required" }, 400, cors);
    const blob = file as File;
    const bytes = await blob.arrayBuffer();
    const resolved = resolveImageType(blob.type || "", bytes);
    if (!resolved) return json({ error: "image must be webp, jpeg, or png" }, 400, cors);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) return json({ error: "image too large (20MB max)" }, 400, cors);
    const hash = await sha256Hex(bytes);
    const objectKey = `editor/_series/${key}/refs/${alias}/${hash}.${resolved.ext}`;
    await putImage(env, objectKey, bytes, resolved.type);
    const extra = parseToonExtra(current);
    const generate = parseGenerateConfig(extra.generate);
    const existing = generate.slots.find((slot) => slot.alias === alias);
    if (existing) {
      existing.kind = "sheet";
      existing.fileKey = objectKey;
    } else {
      generate.slots.push({
        alias,
        label: `Image ${generate.slots.length + 1} — ${alias}`,
        kind: "sheet",
        fileKey: objectKey,
        fileUrl: null,
      });
    }
    extra.generate = generate;
    await env.DB.prepare(`UPDATE series SET extra_json = ?, updated_at = ? WHERE key = ?`)
      .bind(JSON.stringify(extra), nowIso(), key)
      .run();
    const row = await env.DB.prepare(
      `SELECT series.*,
              (SELECT COUNT(*) FROM toons WHERE toons.series_key = series.key) AS toon_count,
              (SELECT group_concat(user_id) FROM series_editors WHERE series_editors.series_key = series.key) AS editor_ids
       FROM series WHERE key = ?`
    )
      .bind(key)
      .first();
    return json(mapSeries(row, request, env), 200, cors);
  }

  const seriesOneMatch = path.match(/^\/series\/([^/]+)$/);
  if (isMethod(method, "GET") && seriesOneMatch) {
    const key = seriesOneMatch[1];
    if (!SLUG_RE.test(key)) return json({ error: "not found" }, 404, cors);
    const row = await env.DB.prepare(
      `SELECT series.*,
              (SELECT COUNT(*) FROM toons WHERE toons.series_key = series.key) AS toon_count,
              (SELECT group_concat(user_id) FROM series_editors WHERE series_editors.series_key = series.key) AS editor_ids
       FROM series WHERE key = ?`
    )
      .bind(key)
      .first();
    if (!row) return json({ error: "not found" }, 404, cors);
    if (!isAdmin(session) && !(await isSeriesEditor(env, key, session ? session.id : ""))) {
      return json({ error: "not found" }, 404, cors);
    }
    const toonRows = (
      await env.DB.prepare(
        `SELECT toons.*,
                (SELECT COUNT(*) FROM pages WHERE pages.toon_id = toons.id) AS page_count
         FROM toons WHERE series_key = ? ORDER BY episode_n ASC, title ASC`
      )
        .bind(key)
        .all()
    ).results;
    return json(
      {
        series: mapSeries(row, request, env),
        toons: toonRows.map((item) => mapToonListItem(item, request, env)),
      },
      200,
      cors
    );
  }

  if (isMethod(method, "PUT") && path === "/series") {
    const parsed = await readJson(request);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
    const key = normaliseSlug(parsed.body.key);
    if (!key || !SLUG_RE.test(key) || key.length > 64) return json({ error: "invalid key" }, 400, cors);
    const existingSeries = await env.DB.prepare("SELECT key FROM series WHERE key = ?").bind(key).first();
    const isMember = existingSeries ? await isSeriesEditor(env, key, session ? session.id : "") : false;
    if (existingSeries && !canManageSeries(session, isMember)) {
      return json({ error: "forbidden" }, 403, cors);
    }
    parsed.body.key = key;
    if (!parsed.body.hubUrl) parsed.body.hubUrl = `/toons/${key}/`;
    await upsertSeries(env, parsed.body, nowIso(), session ? session.id : null);
    const editorIds = Array.isArray(parsed.body.editorIds)
      ? parsed.body.editorIds.filter((id: unknown): id is string => typeof id === "string")
      : null;
    if (!existingSeries) {
      // Creating: an editor keeps themselves on it, or an admin's explicit
      // list is authoritative (may be empty — a house series).
      const initial = isAdmin(session) && editorIds ? editorIds : session ? [session.id] : [];
      await syncSeriesEditors(env, key, initial);
    } else if (isAdmin(session) && editorIds) {
      await syncSeriesEditors(env, key, editorIds);
    }
    const row = await env.DB.prepare(
      `SELECT series.*,
              (SELECT COUNT(*) FROM toons WHERE toons.series_key = series.key) AS toon_count,
              (SELECT group_concat(user_id) FROM series_editors WHERE series_editors.series_key = series.key) AS editor_ids
       FROM series WHERE key = ?`
    )
      .bind(key)
      .first();
    return json(mapSeries(row, request, env), 200, cors);
  }

  if (isMethod(method, "GET") && path === "/sitemap.xml") {
    const origin = siteOriginFromRequest(request);
    const statuses = publicStatusesForRequest(request);
    const seriesRows = (await env.DB.prepare("SELECT * FROM series ORDER BY sort ASC, title ASC").all<SeriesRow>())
      .results;
    const toonRows = (
      await env.DB.prepare(
        `SELECT * FROM toons WHERE status IN (${statuses.map(() => "?").join(",")}) ORDER BY updated_at DESC`
      )
        .bind(...statuses)
        .all<ToonRow>()
    ).results;
    const visibleKeys = new Set(toonRows.map((row) => row.series_key).filter((key): key is string => Boolean(key)));
    const series = seriesRows
      .filter((row) => visibleKeys.has(row.key))
      .map((row) => ({
        hubUrl: row.hub_url,
        coverUrl: objectUrl(request, env, row.cover_key, null),
        title: row.title,
        updatedAt: row.updated_at || null,
      }));
    const toons = toonRows.map((row) => ({
      readerUrl: row.reader_url || null,
      slug: row.slug,
      coverUrl: objectUrl(request, env, row.cover_key, row.asset_page_dir),
      title: row.title,
      updatedAt: row.updated_at || null,
      status: row.status || "draft",
    }));
    const urls = [
      ...staticSitemapUrls(origin, String(env.ASSET_BASE || "")),
      ...toonSitemapUrls(origin, series, toons),
    ];
    return xml(renderSitemapXml(urls), cors);
  }

  if (isMethod(method, "GET") && path === "/catalog") {
    const seriesRows = (await env.DB.prepare("SELECT * FROM series ORDER BY sort ASC, title ASC").all()).results;
    const statuses = publicStatusesForRequest(request);
    const countRows = (
      await env.DB.prepare(
        `SELECT series_key AS key, COUNT(*) AS n FROM toons
         WHERE series_key IS NOT NULL AND series_key != ''
           AND status IN (${statuses.map(() => "?").join(",")})
         GROUP BY series_key`
      )
        .bind(...statuses)
        .all()
    ).results;
    const episodeCounts = new Map(countRows.map((row) => [row.key, Number(row.n) || 0]));
    const toonRows = (
      await env.DB.prepare(
        `SELECT toons.*,
                (SELECT COUNT(*) FROM pages WHERE pages.toon_id = toons.id) AS page_count
         FROM toons
         WHERE status IN (${statuses.map(() => "?").join(",")})
         ORDER BY episode_n ASC, title ASC`
      )
        .bind(...statuses)
        .all()
    ).results;
    const episodesOf = (key: string) =>
      toonRows
        .filter((row) => (row as unknown as ToonRow).series_key === key)
        .map((row) => mapCatalogEpisode(row, request, env));
    const series = seriesRows
      .map((row) => {
        const descriptions = descriptionMap(row);
        return {
          key: row.key,
          title: row.title,
          tagline: row.tagline,
          description: descriptions.en || row.description,
          descriptions,
          coverUrl: objectUrl(request, env, String(row.cover_key || "") || null, null),
          hubUrl: (row.hub_url as string | null) || null,
          episodes: episodesOf(String(row.key)),
          episodeCount: episodeCounts.get(String(row.key)) || 0,
        };
      })
      .filter((item) => item.episodes.length > 0);
    const grouped = new Set(series.flatMap((item) => item.episodes.map((ep) => ep.slug)));
    const ungrouped = toonRows
      .filter((row) => {
        const t = row as unknown as ToonRow;
        return !t.series_key || !grouped.has(t.slug);
      })
      .map((row) => mapCatalogEpisode(row, request, env));
    return json({ series, ungrouped }, 200, cors);
  }

  if (isMethod(method, "POST") && path === "/toons/import") {
    const parsed = await readJson(request);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
    const config = parsed.body.config as { pages?: { file: string; words?: WordInput[] }[] } | undefined;
    if (!config || !Array.isArray(config.pages)) return json({ error: "config.pages required" }, 400, cors);
    const pack = configToImport(config, parsed.body);
    const slug = normaliseSlug(pack.slug);
    if (!slug || !SLUG_RE.test(slug)) return json({ error: "invalid slug" }, 400, cors);
    const ts = nowIso();
    await upsertSeries(env, parsed.body.series as SeriesMeta | undefined, ts);
    let id: string | null = typeof parsed.body.id === "string" ? parsed.body.id : null;
    const existing = await env.DB.prepare("SELECT * FROM toons WHERE slug = ?").bind(slug).first<ToonRow>();
    if (existing) {
      id = existing.id;
      const pageRows = (await env.DB.prepare("SELECT id FROM pages WHERE toon_id = ?").bind(id).all()).results;
      for (const p of pageRows) {
        await env.DB.prepare("DELETE FROM bubbles WHERE page_id = ?").bind(p.id).run();
      }
      await env.DB.prepare("DELETE FROM pages WHERE toon_id = ?").bind(id).run();
      const prevExtra = parseToonExtra(existing);
      let nextExtra = {};
      if (pack.extraJson) {
        try {
          const parsed = JSON.parse(pack.extraJson);
          if (parsed && typeof parsed === "object") nextExtra = parsed;
        } catch {
          /* keep empty */
        }
      }
      const extraJson = JSON.stringify({ ...prevExtra, ...nextExtra });
      await env.DB.prepare(
        `UPDATE toons SET title = ?, subtitle = ?, description = ?, cover_key = ?,
         design_width = ?, design_height = ?, status = ?, reader_url = ?, asset_page_dir = ?,
         extra_json = ?, series_key = ?, episode_n = ?, updated_at = ? WHERE id = ?`
      )
        .bind(
          pack.title,
          pack.subtitle,
          pack.description,
          pack.coverKey,
          pack.designWidth,
          pack.designHeight,
          pack.status,
          pack.readerUrl,
          pack.assetPageDir,
          extraJson,
          pack.seriesKey,
          pack.episodeN,
          ts,
          id
        )
        .run();
    } else {
      id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO toons (id, slug, title, subtitle, description, cover_key, design_width, design_height,
         status, reader_url, asset_page_dir, extra_json, series_key, episode_n, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          slug,
          pack.title,
          pack.subtitle,
          pack.description,
          pack.coverKey,
          pack.designWidth,
          pack.designHeight,
          pack.status,
          pack.readerUrl,
          pack.assetPageDir,
          pack.extraJson,
          pack.seriesKey,
          pack.episodeN,
          ts,
          ts
        )
        .run();
    }
    for (const page of pack.pages) {
      const pageId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO pages (id, toon_id, position, file_key, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(pageId, id, page.position, page.file, pack.designWidth, pack.designHeight, ts)
        .run();
      for (const word of page.words) {
        await env.DB.prepare(
          `INSERT INTO bubbles (id, page_id, x, y, variant, tail, size, angle, text_en, text_json, extra_json, sort, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            crypto.randomUUID(),
            pageId,
            word.x,
            word.y,
            word.variant,
            word.tail,
            word.size,
            word.angle,
            word.textEn,
            word.textJson,
            word.extraJson,
            word.sort,
            ts,
            ts
          )
          .run();
      }
    }
    return json(await loadToon(env, request, id as string), existing ? 200 : 201, cors);
  }

  if (isMethod(method, "GET") && path === "/toons") {
    const toonsListSql = `SELECT toons.*,
                (SELECT COUNT(*) FROM pages WHERE pages.toon_id = toons.id) AS page_count
         FROM toons
         ${
           isAdmin(session)
             ? ""
             : `WHERE (series_key IN (SELECT series_key FROM series_editors WHERE user_id = ?))
                OR (series_key IS NULL AND owner_id = ?)`
         }
         ORDER BY updated_at DESC`;
    const stmt = isAdmin(session)
      ? env.DB.prepare(toonsListSql)
      : env.DB.prepare(toonsListSql).bind(session ? session.id : "", session ? session.id : "");
    const rows = (await stmt.all()).results;
    return json(
      rows.map((row) => mapToonListItem(row, request, env)),
      200,
      cors
    );
  }

  if (isMethod(method, "POST") && path === "/toons") {
    const parsed = await readJson(request);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
    const body = parsed.body;
    const slug = normaliseSlug(body.slug || body.title);
    if (!slug || !SLUG_RE.test(slug) || slug.length > 64) {
      return json({ error: "invalid slug" }, 400, cors);
    }
    const existing = await env.DB.prepare("SELECT id FROM toons WHERE slug = ?").bind(slug).first();
    if (existing) return json({ error: "slug taken" }, 409, cors);
    const status = parseStatus(body.status, "draft");
    const publishErr = publishError(session, status);
    if (publishErr) return json({ error: publishErr }, 403, cors);
    const seriesKey = parseSeriesKey(body, null);
    if (seriesKey) {
      const seriesExists = await env.DB.prepare("SELECT key FROM series WHERE key = ?").bind(seriesKey).first();
      if (seriesExists) {
        const isMember = await isSeriesEditor(env, seriesKey, session ? session.id : "");
        if (!canManageSeries(session, isMember)) return json({ error: "forbidden" }, 403, cors);
      }
    }
    const id = crypto.randomUUID();
    const ts = nowIso();
    const extra: JsonRecord = {};
    const desc = applyDescriptions(extra, body, String(body.description || "").trim());
    const episodeN = seriesKey ? parseEpisodeN(body, null) : null;
    const readerUrl = await deriveReaderUrl(env, seriesKey, slug);
    await env.DB.prepare(
      `INSERT INTO toons (id, slug, title, subtitle, description, status, reader_url, extra_json, series_key, episode_n, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        slug,
        String(body.title || "").trim(),
        String(body.subtitle || "").trim(),
        desc.en,
        status,
        readerUrl,
        JSON.stringify(extra),
        seriesKey,
        episodeN,
        session ? session.id : null,
        ts,
        ts
      )
      .run();
    const toon = await loadToon(env, request, id);
    return json(toon, 201, cors);
  }

  const toonMatch = path.match(/^\/toons\/([^/]+)$/);
  if (isMethod(method, "GET") && toonMatch) {
    const id = toonMatch[1];
    const toon = await loadToon(env, request, id);
    if (!toon) return json({ error: "not found" }, 404, cors);
    if (!isAdmin(session)) {
      const isMember = toon.seriesKey ? await isSeriesEditor(env, toon.seriesKey, session ? session.id : "") : false;
      if (!canManageToon(session, { owner_id: toon.ownerId, series_key: toon.seriesKey }, isMember)) {
        return json({ error: "not found" }, 404, cors);
      }
    }
    return json(toon, 200, cors);
  }
  if (isMethod(method, "PATCH") && toonMatch) {
    const id = toonMatch[1];
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first<ToonRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    const isCurrentMember = current.series_key
      ? await isSeriesEditor(env, current.series_key, session ? session.id : "")
      : false;
    if (!canManageToon(session, current, isCurrentMember)) {
      return json({ error: "forbidden" }, 403, cors);
    }
    const parsed = await readJson(request);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
    const body = parsed.body;
    const title = body.title != null ? String(body.title).trim() : current.title;
    const subtitle = body.subtitle != null ? String(body.subtitle).trim() : current.subtitle;
    const status = parseStatus(body.status, parseStatus(current.status, "draft"));
    const publishErr = publishError(session, status);
    if (publishErr) return json({ error: publishErr }, 403, cors);
    const extra = parseToonExtra(current);
    const desc = applyDescriptions(extra, body, current.description);
    const description = desc.en;
    applyTitles(extra, body, title);
    const seriesKey = parseSeriesKey(body, current.series_key || null);
    if (seriesKey && seriesKey !== current.series_key) {
      const nextSeriesExists = await env.DB.prepare("SELECT key FROM series WHERE key = ?").bind(seriesKey).first();
      if (nextSeriesExists) {
        const isNextMember = await isSeriesEditor(env, seriesKey, session ? session.id : "");
        if (!canManageSeries(session, isNextMember)) return json({ error: "forbidden" }, 403, cors);
      }
    }
    const episodeN = seriesKey ? parseEpisodeN(body, current.episode_n ?? null) : null;
    const readerUrl = (await deriveReaderUrl(env, seriesKey, current.slug)) || current.reader_url;
    await env.DB.prepare(
      `UPDATE toons SET title = ?, subtitle = ?, description = ?, status = ?, extra_json = ?, series_key = ?, episode_n = ?, reader_url = ?, updated_at = ? WHERE id = ?`
    )
      .bind(title, subtitle, description, status, JSON.stringify(extra), seriesKey, episodeN, readerUrl, nowIso(), id)
      .run();
    return json(await loadToon(env, request, id), 200, cors);
  }

  const coverMatch = path.match(/^\/toons\/([^/]+)\/cover$/);
  if (isMethod(method, "POST") && coverMatch) {
    const id = coverMatch[1];
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first<ToonRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    const upload = await readUpload(request);
    if ("error" in upload) return json({ error: upload.error }, 400, cors);
    const optimized = await toWebp(upload);
    const hash = await sha256Hex(optimized.bytes);
    const key = `editor/${current.slug}/cover/${hash}.${optimized.ext}`;
    await putImage(env, key, optimized.bytes, optimized.type);
    await env.DB.prepare(`UPDATE toons SET cover_key = ?, updated_at = ? WHERE id = ?`).bind(key, nowIso(), id).run();
    return json(await loadToon(env, request, id), 200, cors);
  }

  const audioGenerateMatch = path.match(/^\/toons\/([^/]+)\/audio\/generate$/);
  if (isMethod(method, "POST") && audioGenerateMatch) {
    const id = audioGenerateMatch[1];
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first<ToonRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    const apiKey = env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) return json({ error: "ElevenLabs is not configured" }, 503, cors);
    const parsed = await readJson(request);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
    const input = parseGenerateAudioBody(parsed.body);
    if (!input.ok) return json({ error: input.error }, 400, cors);
    const clip = await generateClip(apiKey, input.value);
    if (!clip.ok) return json({ error: clip.error }, clip.status, cors);
    if (clip.bytes.byteLength > MAX_UPLOAD_BYTES) return json({ error: "audio too large (20MB max)" }, 400, cors);
    const key = await putCaptionAudio(env, current.slug, clip.bytes);
    if (session) {
      try {
        await insertCreditEvent(env, {
          userId: session.id,
          kind: "audio",
          tokens: input.value.text.length,
          source: "elevenlabs-generate",
        });
      } catch {
        /* generate still succeeded */
      }
    }
    return json({ key, url: mediaUrl(request, key), audio: key }, 201, cors);
  }

  const audioMatch = path.match(/^\/toons\/([^/]+)\/audio$/);
  if (isMethod(method, "POST") && audioMatch) {
    const id = audioMatch[1];
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first<ToonRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    const upload = await readAudioUpload(request);
    if ("error" in upload) return json({ error: upload.error }, 400, cors);
    const key = await putCaptionAudio(env, current.slug, upload.bytes);
    return json({ key, url: mediaUrl(request, key), audio: key }, 201, cors);
  }

  const pagesGenerateMatch = path.match(/^\/toons\/([^/]+)\/pages\/generate$/);
  if (isMethod(method, "POST") && pagesGenerateMatch) {
    const id = pagesGenerateMatch[1];
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first<ToonRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    if (!current.series_key) return json({ error: "toon is not in a series" }, 400, cors);
    const series = await env.DB.prepare("SELECT * FROM series WHERE key = ?")
      .bind(current.series_key)
      .first<SeriesRow>();
    if (!series) return json({ error: "series not found" }, 404, cors);
    const form = await request.formData();
    const prompt = String(form.get("prompt") || "").trim();
    if (!prompt) return json({ error: "prompt is required" }, 400, cors);
    const includePrevious = form.get("includePrevious") !== "0";
    const pageId = form.get("pageId") ? String(form.get("pageId")) : null;
    const previousFile = form.get("previousFile");
    let previousOverride: { bytes: ArrayBuffer; type: string } | null = null;
    if (previousFile && typeof previousFile !== "string") {
      const blob = previousFile as File;
      const bytes = await blob.arrayBuffer();
      const resolved = resolveImageType(blob.type || "", bytes);
      if (!resolved) return json({ error: "previous-plate image must be webp, jpeg, or png" }, 400, cors);
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        return json({ error: "previous-plate image too large (20MB max)" }, 400, cors);
      }
      previousOverride = { bytes, type: resolved.type };
    }
    const started = await startPageGenerate(env, {
      toon: current,
      series,
      prompt,
      includePrevious,
      pageId,
      previousOverride,
    });
    if (!started.ok) return json({ error: started.error }, started.status, cors);
    return json(
      {
        id: started.job.id,
        status: started.job.status,
        comfyPromptId: started.job.comfy_prompt_id,
      },
      202,
      cors
    );
  }

  const pagesMatch = path.match(/^\/toons\/([^/]+)\/pages$/);
  if (isMethod(method, "POST") && pagesMatch) {
    const id = pagesMatch[1];
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first<ToonRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    const upload = await readUpload(request);
    if ("error" in upload) return json({ error: upload.error }, 400, cors);
    const key = await putPageAsset(env, current.slug, upload);
    const posRow = await env.DB.prepare("SELECT COALESCE(MAX(position), -1) AS max_pos FROM pages WHERE toon_id = ?")
      .bind(id)
      .first();
    const position = (posRow && Number(posRow.max_pos) > -1 ? Number(posRow.max_pos) : -1) + 1;
    const pageId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO pages (id, toon_id, position, file_key, width, height, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(pageId, id, position, key, upload.width, upload.height, nowIso())
      .run();
    const stillDefault = current.design_width === 800 && current.design_height === 1424;
    if (stillDefault && upload.width && upload.height && position === 0) {
      await env.DB.prepare(`UPDATE toons SET design_width = ?, design_height = ?, updated_at = ? WHERE id = ?`)
        .bind(upload.width, upload.height, nowIso(), id)
        .run();
    } else {
      await env.DB.prepare(`UPDATE toons SET updated_at = ? WHERE id = ?`).bind(nowIso(), id).run();
    }
    return json(await loadToon(env, request, id), 201, cors);
  }

  const replacePageMatch = path.match(/^\/pages\/([^/]+)\/file$/);
  if (isMethod(method, "POST") && replacePageMatch) {
    const page = await getPageOrNull(env, replacePageMatch[1]);
    if (!page) return json({ error: "not found" }, 404, cors);
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(page.toon_id).first<ToonRow>();
    if (!current) return json({ error: "not found" }, 404, cors);
    const upload = await readUpload(request);
    if ("error" in upload) return json({ error: upload.error }, 400, cors);
    const key = await putPageAsset(env, current.slug, upload);
    const width = upload.width || page.width || null;
    const height = upload.height || page.height || null;
    await env.DB.prepare(`UPDATE pages SET file_key = ?, width = ?, height = ? WHERE id = ?`)
      .bind(key, width, height, page.id)
      .run();
    await env.DB.prepare(`UPDATE toons SET updated_at = ? WHERE id = ?`).bind(nowIso(), page.toon_id).run();
    return json(await loadToon(env, request, page.toon_id), 200, cors);
  }

  const exportMatch = path.match(/^\/toons\/([^/]+)\/export$/);
  if (isMethod(method, "GET") && exportMatch) {
    const toon = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(exportMatch[1]).first<ToonRow>();
    if (!toon) return json({ error: "not found" }, 404, cors);
    return json(await readerConfigFromToon(env, toon, request), 200, cors);
  }

  const pageMatch = path.match(/^\/pages\/([^/]+)$/);
  if (isMethod(method, "DELETE") && pageMatch) {
    const page = await getPageOrNull(env, pageMatch[1]);
    if (!page) return json({ error: "not found" }, 404, cors);
    await env.DB.prepare("DELETE FROM bubbles WHERE page_id = ?").bind(page.id).run();
    await env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(page.id).run();
    await env.DB.prepare("UPDATE pages SET position = position - 1 WHERE toon_id = ? AND position > ?")
      .bind(page.toon_id, page.position)
      .run();
    await env.DB.prepare("UPDATE toons SET updated_at = ? WHERE id = ?").bind(nowIso(), page.toon_id).run();
    return json({ ok: true }, 200, cors);
  }

  const addBubbleMatch = path.match(/^\/pages\/([^/]+)\/bubbles$/);
  if (isMethod(method, "POST") && addBubbleMatch) {
    const page = await getPageOrNull(env, addBubbleMatch[1]);
    if (!page) return json({ error: "not found" }, 404, cors);
    const parsed = await readJson(request);
    if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
    const body = parsed.body;
    const sortRow = await env.DB.prepare("SELECT COALESCE(MAX(sort), -1) AS max_sort FROM bubbles WHERE page_id = ?")
      .bind(page.id)
      .first<{ max_sort: number }>();
    const sort = (sortRow && Number(sortRow.max_sort) > -1 ? Number(sortRow.max_sort) : -1) + 1;
    const id = crypto.randomUUID();
    const ts = nowIso();
    const variant = String(body.variant || DEFAULT_VARIANT);
    const tail = body.tail != null ? String(body.tail) : DEFAULT_TAIL;
    await env.DB.prepare(
      `INSERT INTO bubbles (id, page_id, x, y, variant, tail, size, angle, text_en, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        page.id,
        clamp01(body.x),
        clamp01(body.y),
        variant,
        tail,
        body.size != null ? Number(body.size) : null,
        body.angle != null ? Number(body.angle) : null,
        String(body.textEn ?? body.text_en ?? ""),
        sort,
        ts,
        ts
      )
      .run();
    const row = await env.DB.prepare("SELECT * FROM bubbles WHERE id = ?").bind(id).first<BubbleRow>();
    await env.DB.prepare("UPDATE toons SET updated_at = ? WHERE id = ?").bind(ts, page.toon_id).run();
    if (!row) return json({ error: "not found" }, 404, cors);
    return json(mapBubble(row), 201, cors);
  }

  const bubbleMatch = path.match(/^\/bubbles\/([^/]+)$/);
  if ((isMethod(method, "DELETE") || isMethod(method, "PATCH")) && bubbleMatch) {
    const row = await env.DB.prepare("SELECT * FROM bubbles WHERE id = ?").bind(bubbleMatch[1]).first<BubbleRow>();
    if (!row) return json({ error: "not found" }, 404, cors);
    if (isMethod(method, "DELETE")) {
      await env.DB.prepare("DELETE FROM bubbles WHERE id = ?").bind(row.id).run();
      const page = await getPageOrNull(env, row.page_id);
      if (page) {
        await env.DB.prepare("UPDATE toons SET updated_at = ? WHERE id = ?").bind(nowIso(), page.toon_id).run();
      }
      return json({ ok: true }, 200, cors);
    }
    if (isMethod(method, "PATCH")) {
      const parsed = await readJson(request);
      if (!parsed.ok) return json({ error: parsed.error }, 400, cors);
      const body = parsed.body;
      const x = body.x != null ? clamp01(body.x) : row.x;
      const y = body.y != null ? clamp01(body.y) : row.y;
      const variant = body.variant != null ? String(body.variant) : row.variant;
      const tail = body.tail !== undefined ? (body.tail == null ? null : String(body.tail)) : row.tail;
      const size = body.size !== undefined ? (body.size == null ? null : Number(body.size)) : row.size;
      const angle = body.angle !== undefined ? (body.angle == null ? null : Number(body.angle)) : row.angle;
      const sort = body.sort != null && Number.isFinite(Number(body.sort)) ? Math.round(Number(body.sort)) : row.sort;
      let textEn =
        body.textEn != null ? String(body.textEn) : body.text_en != null ? String(body.text_en) : row.text_en;
      let textJson = row.text_json;
      if (body.textJson != null) {
        textJson = typeof body.textJson === "string" ? body.textJson : JSON.stringify(body.textJson);
        try {
          const map = JSON.parse(textJson);
          if (map && map.en != null) textEn = String(map.en);
        } catch {
          /* keep textEn */
        }
      } else if (body.textEn != null || body.text_en != null) {
        try {
          const map = (textJson ? JSON.parse(textJson) : {}) as JsonRecord;
          map.en = textEn;
          textJson = JSON.stringify(map);
        } catch {
          textJson = JSON.stringify({ en: textEn });
        }
      }
      let extraJson = row.extra_json;
      if (body.extraJson !== undefined) {
        if (body.extraJson == null || body.extraJson === "") extraJson = null;
        else extraJson = typeof body.extraJson === "string" ? body.extraJson : JSON.stringify(body.extraJson);
      }
      const ts = nowIso();
      await env.DB.prepare(
        `UPDATE bubbles SET x = ?, y = ?, variant = ?, tail = ?, size = ?, angle = ?, text_en = ?, text_json = ?, extra_json = ?, sort = ?, updated_at = ?
         WHERE id = ?`
      )
        .bind(x, y, variant, tail, size, angle, textEn, textJson, extraJson, sort, ts, row.id)
        .run();
      const next = await env.DB.prepare("SELECT * FROM bubbles WHERE id = ?").bind(row.id).first<BubbleRow>();
      if (!next) return json({ error: "not found" }, 404, cors);
      return json(mapBubble(next), 200, cors);
    }
  }

  return json({ error: "not found" }, 404, cors);
}

export { deriveReaderUrl, isPublicRoute, publicWord, readerConfigFromToon };

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    const method = request.method;
    if (isMethod(method, "OPTIONS")) {
      return new Response(null, { status: 204, headers: cors });
    }

    const origin = request.headers.get("Origin");
    if (origin && !cors["Access-Control-Allow-Origin"]) {
      return json({ error: "forbidden origin" }, 403, cors);
    }

    const path = new URL(request.url).pathname.replace(/\/$/, "") || "/";
    try {
      const publicRoute = isPublicRoute(method, path);
      const session = publicRoute ? null : await userFromRequest(request, env);
      if (!publicRoute && !session) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      return await handle(request, env, cors, session);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "server error" }, 500, cors);
    }
  },
};

export default worker;
