/**
 * Toon editor API — D1 drafts + R2 plates/covers.
 *
 * Public: CORS preflight, GET /media/editor/…, GET /auth/status,
 * GET /catalog, GET /config/:slug (published; staging hosts also see status=staging), GET/POST /likes,
 * POST /auth/login, POST /auth/register (first account only).
 * Everything else needs a JWT: Authorization: Bearer <login token>.
 */
import {
  hashPassword,
  issueToken,
  normaliseEmail,
  publicUser,
  userCount,
  userFromRequest,
  validateCredentials,
  verifyPassword,
} from "./auth.js";
import { configToImport, descriptionMapFromMeta, rowToWord } from "./importConfig.js";
import { handleLikes } from "./likes.js";
import { parseStatus, publicStatusesForRequest } from "./visibility.js";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const AUDIO_TYPES = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
};
const DEFAULT_VARIANT = "bubble";
const DEFAULT_TAIL = "bottom-left";

function isDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|local\.twentyseven\.test)(:\d+)?$/.test(origin);
}

function allowedOriginList(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowedOriginList(env).includes(origin) || isDevOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

function isPublicConfigPath(path) {
  return /^\/config\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path);
}

function isPublicRoute(method, path) {
  if (method === "GET" && path.startsWith("/media/")) return true;
  if (method === "GET" && path === "/auth/status") return true;
  if (method === "GET" && path === "/catalog") return true;
  if (method === "GET" && isPublicConfigPath(path)) return true;
  if (path === "/likes" && (method === "GET" || method === "POST")) return true;
  if (method === "POST" && (path === "/auth/login" || path === "/auth/register")) return true;
  return false;
}

/** Listed production origins may POST a like. Dev hosts may only GET counts. */
function isWriteOrigin(request, env) {
  return allowedOriginList(env).includes(request.headers.get("Origin") || "");
}

async function readJson(request) {
  try {
    return { body: await request.json() };
  } catch {
    return { error: "invalid json" };
  }
}

function nowIso() {
  return new Date().toISOString();
}

function mediaUrl(request, key) {
  if (!key) return null;
  const origin = new URL(request.url).origin;
  return `${origin}/media/${key}`;
}

function objectUrl(request, env, key, pageDir) {
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

function mapBubble(row) {
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    variant: row.variant,
    tail: row.tail,
    size: row.size,
    angle: row.angle,
    textEn: row.text_en,
    textJson: row.text_json || null,
    extraJson: row.extra_json || null,
    sort: row.sort,
  };
}

function mapPage(row, request, env, pageDir, bubbles) {
  return {
    id: row.id,
    position: row.position,
    fileKey: row.file_key,
    fileUrl: objectUrl(request, env, row.file_key, pageDir),
    width: row.width,
    height: row.height,
    bubbles: bubbles || [],
  };
}

function mapToon(row, request, env, pages) {
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
    pages: pages || [],
  };
}

function wordFromBubble(b) {
  return rowToWord(b);
}

/** FlipFrame readers resolve relative paths on the CDN; editor clips live on this Worker. */
function publicWord(request, word) {
  const audio = word && word.audio;
  if (typeof audio === "string" && audio.startsWith("editor/")) {
    return { ...word, audio: mediaUrl(request, audio) };
  }
  return word;
}

function parseToonExtra(toon) {
  if (!toon || !toon.extra_json) return {};
  try {
    const extra = JSON.parse(toon.extra_json);
    return extra && typeof extra === "object" ? extra : {};
  } catch {
    return {};
  }
}

const DESC_LANGS = ["en", "it", "de", "fr"];

function langMap(row, extraKey, column) {
  const extra = parseToonExtra(row);
  const raw = extra[extraKey];
  const map = { en: String(row[column] || ""), it: "", de: "", fr: "" };
  if (raw && typeof raw === "object") {
    for (const lang of DESC_LANGS) {
      if (typeof raw[lang] === "string") map[lang] = raw[lang];
    }
  }
  if (!String(map.en || "").trim()) map.en = String(row[column] || "");
  return map;
}

function descriptionMap(row) {
  return langMap(row, "description", "description");
}

function titleMap(row) {
  return langMap(row, "title", "title");
}

function applyDescriptions(extra, body, enFallback) {
  const current = extra.description && typeof extra.description === "object" ? extra.description : {};
  const incoming = body.descriptions && typeof body.descriptions === "object" ? body.descriptions : null;
  const map = {};
  for (const lang of DESC_LANGS) {
    if (incoming && incoming[lang] != null) map[lang] = String(incoming[lang]).trim();
    else if (lang === "en" && body.description != null) map.en = String(body.description).trim();
    else map[lang] = String(current[lang] || (lang === "en" ? enFallback : "") || "").trim();
  }
  extra.description = map;
  return map;
}

function applyTitles(extra, body, enFallback) {
  const incoming = body.titles && typeof body.titles === "object" ? body.titles : null;
  if (!incoming) return extra.title || null;
  const current = extra.title && typeof extra.title === "object" ? extra.title : {};
  const map = {};
  for (const lang of DESC_LANGS) {
    if (incoming[lang] != null) map[lang] = String(incoming[lang]).trim();
    else map[lang] = String(current[lang] || (lang === "en" ? enFallback : "") || "").trim();
  }
  extra.title = map;
  return map;
}

async function upsertSeries(env, seriesMeta, ts) {
  if (!seriesMeta || !seriesMeta.key) return;
  const skey = String(seriesMeta.key);
  const extra = {};
  extra.description = descriptionMapFromMeta(seriesMeta);
  const extraJson = JSON.stringify(extra);
  const description = extra.description.en || String(seriesMeta.description || "");
  const found = await env.DB.prepare("SELECT key FROM series WHERE key = ?").bind(skey).first();
  if (found) {
    await env.DB.prepare(
      `UPDATE series SET title = ?, tagline = ?, description = ?, cover_key = ?, hub_url = ?, sort = ?, extra_json = ?, updated_at = ?
       WHERE key = ?`
    )
      .bind(
        String(seriesMeta.title || ""),
        String(seriesMeta.tagline || ""),
        description,
        seriesMeta.coverKey || null,
        seriesMeta.hubUrl || null,
        Number(seriesMeta.sort) || 0,
        extraJson,
        ts,
        skey
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO series (key, title, tagline, description, cover_key, hub_url, sort, extra_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        skey,
        String(seriesMeta.title || ""),
        String(seriesMeta.tagline || ""),
        description,
        seriesMeta.coverKey || null,
        seriesMeta.hubUrl || null,
        Number(seriesMeta.sort) || 0,
        extraJson,
        ts,
        ts
      )
      .run();
  }
}

async function readerConfigFromToon(env, toon, request) {
  const extra = parseToonExtra(toon);
  const pageRows = (
    await env.DB.prepare("SELECT * FROM pages WHERE toon_id = ? ORDER BY position ASC").bind(toon.id).all()
  ).results;
  const pages = [];
  for (const page of pageRows) {
    const bubbleRows = (
      await env.DB.prepare("SELECT * FROM bubbles WHERE page_id = ? ORDER BY sort ASC, created_at ASC")
        .bind(page.id)
        .all()
    ).results;
    pages.push({
      file: page.file_key,
      words: bubbleRows.map((row) => publicWord(request, wordFromBubble(row))),
    });
  }
  const cfg = {
    title: toon.title,
    designWidth: toon.design_width,
    designHeight: toon.design_height,
    defaultLang: extra.defaultLang || "en",
    languages: extra.languages || [{ code: "en", label: "EN" }],
    pages,
  };
  if (extra.reverb) cfg.reverb = extra.reverb;
  return cfg;
}

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function normaliseSlug(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadToon(env, request, id) {
  const toon = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first();
  if (!toon) return null;
  const pageRows = (await env.DB.prepare("SELECT * FROM pages WHERE toon_id = ? ORDER BY position ASC").bind(id).all())
    .results;
  const pages = [];
  for (const page of pageRows) {
    const bubbleRows = (
      await env.DB.prepare("SELECT * FROM bubbles WHERE page_id = ? ORDER BY sort ASC, created_at ASC")
        .bind(page.id)
        .all()
    ).results;
    pages.push(mapPage(page, request, env, toon.asset_page_dir, bubbleRows.map(mapBubble)));
  }
  return mapToon(toon, request, env, pages);
}

async function getPageOrNull(env, pageId) {
  return env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(pageId).first();
}

async function putImage(env, key, bytes, contentType) {
  await env.ASSETS.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
}

async function putPageAsset(env, slug, upload) {
  const hash = await sha256Hex(upload.bytes);
  const key = `editor/${slug}/assets/${hash}.${upload.ext}`;
  await putImage(env, key, upload.bytes, upload.type);
  return key;
}

async function readUpload(request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return { error: "file is required" };
  }
  const type = file.type || "";
  const ext = IMAGE_TYPES[type];
  if (!ext) return { error: "image must be webp, jpeg, or png" };
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { error: "image too large (8MB max)" };
  const width = form.get("width") != null ? Number(form.get("width")) : null;
  const height = form.get("height") != null ? Number(form.get("height")) : null;
  return {
    bytes,
    ext,
    type,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : null,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : null,
  };
}

function audioExtFromName(name) {
  return String(name || "")
    .toLowerCase()
    .endsWith(".mp3")
    ? "mp3"
    : "";
}

async function readAudioUpload(request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return { error: "file is required" };
  }
  const ext = AUDIO_TYPES[file.type] || audioExtFromName(file.name);
  if (!ext) return { error: "audio must be mp3" };
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { error: "audio too large (8MB max)" };
  const type = "audio/mpeg";
  return { bytes, ext, type };
}

async function handle(request, env, cors, session) {
  const likes = await handleLikes(request, env, cors, json, isWriteOrigin);
  if (likes) return likes;

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = request.method;

  if (method === "GET" && path === "/auth/status") {
    return json({ hasUsers: (await userCount(env)) > 0 }, 200, cors);
  }

  if (method === "POST" && path === "/auth/register") {
    if ((await userCount(env)) > 0) return json({ error: "registration closed" }, 403, cors);
    const parsed = await readJson(request);
    if (parsed.error) return json({ error: parsed.error }, 400, cors);
    const email = normaliseEmail(parsed.body.email);
    const password = String(parsed.body.password || "");
    const invalid = validateCredentials(email, password);
    if (invalid) return json({ error: invalid }, 400, cors);
    const id = crypto.randomUUID();
    const ts = nowIso();
    await env.DB.prepare(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`)
      .bind(id, email, await hashPassword(password), ts)
      .run();
    const sess = await issueToken(env, { id, email });
    return json({ token: sess.token, user: publicUser({ id, email }) }, 201, cors);
  }

  if (method === "POST" && path === "/auth/login") {
    const parsed = await readJson(request);
    if (parsed.error) return json({ error: parsed.error }, 400, cors);
    const email = normaliseEmail(parsed.body.email);
    const password = String(parsed.body.password || "");
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return json({ error: "invalid email or password" }, 401, cors);
    }
    const sess = await issueToken(env, { id: user.id, email: user.email });
    return json({ token: sess.token, user: publicUser({ id: user.id, email: user.email }) }, 200, cors);
  }

  if (method === "GET" && path === "/auth/me") {
    return json({ user: publicUser(session) }, 200, cors);
  }

  if (method === "POST" && path === "/auth/logout") {
    return json({ ok: true }, 200, cors);
  }

  if (method === "POST" && path === "/auth/users") {
    const parsed = await readJson(request);
    if (parsed.error) return json({ error: parsed.error }, 400, cors);
    const email = normaliseEmail(parsed.body.email);
    const password = String(parsed.body.password || "");
    const invalid = validateCredentials(email, password);
    if (invalid) return json({ error: invalid }, 400, cors);
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return json({ error: "email taken" }, 409, cors);
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`)
      .bind(id, email, await hashPassword(password), nowIso())
      .run();
    return json({ user: publicUser({ id, email }) }, 201, cors);
  }

  const mediaMatch = path.match(/^\/media\/(.+)$/);
  if (mediaMatch && method === "GET") {
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
  if (publicConfigMatch && method === "GET") {
    const slug = publicConfigMatch[1];
    if (!SLUG_RE.test(slug)) return json({ error: "not found" }, 404, cors);
    const statuses = publicStatusesForRequest(request);
    const toon = await env.DB.prepare(
      `SELECT * FROM toons WHERE slug = ? AND status IN (${statuses.map(() => "?").join(",")})`
    )
      .bind(slug, ...statuses)
      .first();
    if (!toon) return json({ error: "not found" }, 404, cors);
    return json(await readerConfigFromToon(env, toon, request), 200, cors);
  }

  if (method === "PUT" && path === "/series") {
    const parsed = await readJson(request);
    if (parsed.error) return json({ error: parsed.error }, 400, cors);
    if (!parsed.body.key) return json({ error: "key required" }, 400, cors);
    await upsertSeries(env, parsed.body, nowIso());
    const row = await env.DB.prepare("SELECT * FROM series WHERE key = ?").bind(String(parsed.body.key)).first();
    const descriptions = descriptionMap(row);
    return json(
      {
        key: row.key,
        title: row.title,
        tagline: row.tagline,
        description: descriptions.en || row.description,
        descriptions,
      },
      200,
      cors
    );
  }

  if (method === "GET" && path === "/catalog") {
    const seriesRows = (await env.DB.prepare("SELECT * FROM series ORDER BY sort ASC, title ASC").all()).results;
    const statuses = publicStatusesForRequest(request);
    const countRows = (
      await env.DB.prepare(
        `SELECT series_key AS key, COUNT(*) AS n FROM toons
         WHERE series_key IS NOT NULL AND series_key != ''
         GROUP BY series_key`
      ).all()
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
    const asEpisode = (row) => {
      const descriptions = descriptionMap(row);
      const titles = titleMap(row);
      return {
        id: row.slug,
        slug: row.slug,
        title: titles.en || row.title,
        titles,
        subtitle: row.subtitle,
        description: descriptions.en,
        descriptions,
        coverUrl: objectUrl(request, env, row.cover_key, row.asset_page_dir),
        pageCount: Number(row.page_count) || 0,
        readerUrl: row.reader_url || null,
        n: row.episode_n,
      };
    };
    const episodesOf = (key) => toonRows.filter((row) => row.series_key === key).map(asEpisode);
    const series = seriesRows
      .map((row) => {
        const descriptions = descriptionMap(row);
        return {
          key: row.key,
          title: row.title,
          tagline: row.tagline,
          description: descriptions.en || row.description,
          descriptions,
          coverUrl: objectUrl(request, env, row.cover_key, null),
          hubUrl: row.hub_url || null,
          episodes: episodesOf(row.key),
          episodeCount: episodeCounts.get(row.key) || 0,
        };
      })
      .filter((item) => item.episodes.length > 0);
    const grouped = new Set(series.flatMap((item) => item.episodes.map((ep) => ep.slug)));
    const ungrouped = toonRows.filter((row) => !row.series_key || !grouped.has(row.slug)).map(asEpisode);
    return json({ series, ungrouped }, 200, cors);
  }

  if (method === "POST" && path === "/toons/import") {
    const parsed = await readJson(request);
    if (parsed.error) return json({ error: parsed.error }, 400, cors);
    const config = parsed.body.config;
    if (!config || !Array.isArray(config.pages)) return json({ error: "config.pages required" }, 400, cors);
    const pack = configToImport(config, parsed.body);
    const slug = normaliseSlug(pack.slug);
    if (!slug || !SLUG_RE.test(slug)) return json({ error: "invalid slug" }, 400, cors);
    const ts = nowIso();
    await upsertSeries(env, parsed.body.series, ts);
    let id = parsed.body.id || null;
    const existing = await env.DB.prepare("SELECT * FROM toons WHERE slug = ?").bind(slug).first();
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
    return json(await loadToon(env, request, id), existing ? 200 : 201, cors);
  }

  if (method === "GET" && path === "/toons") {
    const rows = (
      await env.DB.prepare(
        `SELECT toons.*,
                (SELECT COUNT(*) FROM pages WHERE pages.toon_id = toons.id) AS page_count
         FROM toons ORDER BY updated_at DESC`
      ).all()
    ).results;
    return json(
      rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle,
        coverUrl: objectUrl(request, env, row.cover_key, row.asset_page_dir),
        pageCount: Number(row.page_count) || 0,
        status: row.status || "draft",
      })),
      200,
      cors
    );
  }

  if (method === "POST" && path === "/toons") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid json" }, 400, cors);
    }
    const slug = normaliseSlug(body.slug || body.title);
    if (!slug || !SLUG_RE.test(slug) || slug.length > 64) {
      return json({ error: "invalid slug" }, 400, cors);
    }
    const existing = await env.DB.prepare("SELECT id FROM toons WHERE slug = ?").bind(slug).first();
    if (existing) return json({ error: "slug taken" }, 409, cors);
    const id = crypto.randomUUID();
    const ts = nowIso();
    const status = parseStatus(body.status, "draft");
    const extra = {};
    const desc = applyDescriptions(extra, body, String(body.description || "").trim());
    await env.DB.prepare(
      `INSERT INTO toons (id, slug, title, subtitle, description, status, extra_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        slug,
        String(body.title || "").trim(),
        String(body.subtitle || "").trim(),
        desc.en,
        status,
        JSON.stringify(extra),
        ts,
        ts
      )
      .run();
    const toon = await loadToon(env, request, id);
    return json(toon, 201, cors);
  }

  const toonMatch = path.match(/^\/toons\/([^/]+)$/);
  if (toonMatch) {
    const id = toonMatch[1];
    if (method === "GET") {
      const toon = await loadToon(env, request, id);
      if (!toon) return json({ error: "not found" }, 404, cors);
      return json(toon, 200, cors);
    }
    if (method === "PATCH") {
      const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first();
      if (!current) return json({ error: "not found" }, 404, cors);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid json" }, 400, cors);
      }
      const title = body.title != null ? String(body.title).trim() : current.title;
      const subtitle = body.subtitle != null ? String(body.subtitle).trim() : current.subtitle;
      const status = parseStatus(body.status, current.status || "draft");
      const extra = parseToonExtra(current);
      const desc = applyDescriptions(extra, body, current.description);
      const description = desc.en;
      applyTitles(extra, body, title);
      await env.DB.prepare(
        `UPDATE toons SET title = ?, subtitle = ?, description = ?, status = ?, extra_json = ?, updated_at = ? WHERE id = ?`
      )
        .bind(title, subtitle, description, status, JSON.stringify(extra), nowIso(), id)
        .run();
      return json(await loadToon(env, request, id), 200, cors);
    }
  }

  const coverMatch = path.match(/^\/toons\/([^/]+)\/cover$/);
  if (coverMatch && method === "POST") {
    const id = coverMatch[1];
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first();
    if (!current) return json({ error: "not found" }, 404, cors);
    const upload = await readUpload(request);
    if (upload.error) return json({ error: upload.error }, 400, cors);
    const hash = await sha256Hex(upload.bytes);
    const key = `editor/${current.slug}/cover/${hash}.${upload.ext}`;
    await putImage(env, key, upload.bytes, upload.type);
    await env.DB.prepare(`UPDATE toons SET cover_key = ?, updated_at = ? WHERE id = ?`).bind(key, nowIso(), id).run();
    return json(await loadToon(env, request, id), 200, cors);
  }

  const audioMatch = path.match(/^\/toons\/([^/]+)\/audio$/);
  if (audioMatch && method === "POST") {
    const id = audioMatch[1];
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first();
    if (!current) return json({ error: "not found" }, 404, cors);
    const upload = await readAudioUpload(request);
    if (upload.error) return json({ error: upload.error }, 400, cors);
    const hash = await sha256Hex(upload.bytes);
    const key = `editor/${current.slug}/sfx/${hash}.${upload.ext}`;
    await putImage(env, key, upload.bytes, upload.type);
    return json({ key, url: mediaUrl(request, key), audio: key }, 201, cors);
  }

  const pagesMatch = path.match(/^\/toons\/([^/]+)\/pages$/);
  if (pagesMatch && method === "POST") {
    const id = pagesMatch[1];
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(id).first();
    if (!current) return json({ error: "not found" }, 404, cors);
    const upload = await readUpload(request);
    if (upload.error) return json({ error: upload.error }, 400, cors);
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
  if (replacePageMatch && method === "POST") {
    const page = await getPageOrNull(env, replacePageMatch[1]);
    if (!page) return json({ error: "not found" }, 404, cors);
    const current = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(page.toon_id).first();
    if (!current) return json({ error: "not found" }, 404, cors);
    const upload = await readUpload(request);
    if (upload.error) return json({ error: upload.error }, 400, cors);
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
  if (exportMatch && method === "GET") {
    const toon = await env.DB.prepare("SELECT * FROM toons WHERE id = ?").bind(exportMatch[1]).first();
    if (!toon) return json({ error: "not found" }, 404, cors);
    return json(await readerConfigFromToon(env, toon, request), 200, cors);
  }

  const pageMatch = path.match(/^\/pages\/([^/]+)$/);
  if (pageMatch && method === "DELETE") {
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
  if (addBubbleMatch && method === "POST") {
    const page = await getPageOrNull(env, addBubbleMatch[1]);
    if (!page) return json({ error: "not found" }, 404, cors);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid json" }, 400, cors);
    }
    const sortRow = await env.DB.prepare("SELECT COALESCE(MAX(sort), -1) AS max_sort FROM bubbles WHERE page_id = ?")
      .bind(page.id)
      .first();
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
    const row = await env.DB.prepare("SELECT * FROM bubbles WHERE id = ?").bind(id).first();
    await env.DB.prepare("UPDATE toons SET updated_at = ? WHERE id = ?").bind(ts, page.toon_id).run();
    return json(mapBubble(row), 201, cors);
  }

  const bubbleMatch = path.match(/^\/bubbles\/([^/]+)$/);
  if (bubbleMatch) {
    const row = await env.DB.prepare("SELECT * FROM bubbles WHERE id = ?").bind(bubbleMatch[1]).first();
    if (!row) return json({ error: "not found" }, 404, cors);
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM bubbles WHERE id = ?").bind(row.id).run();
      const page = await getPageOrNull(env, row.page_id);
      if (page) {
        await env.DB.prepare("UPDATE toons SET updated_at = ? WHERE id = ?").bind(nowIso(), page.toon_id).run();
      }
      return json({ ok: true }, 200, cors);
    }
    if (method === "PATCH") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid json" }, 400, cors);
      }
      const x = body.x != null ? clamp01(body.x) : row.x;
      const y = body.y != null ? clamp01(body.y) : row.y;
      const variant = body.variant != null ? String(body.variant) : row.variant;
      const tail = body.tail !== undefined ? (body.tail == null ? null : String(body.tail)) : row.tail;
      const size = body.size !== undefined ? (body.size == null ? null : Number(body.size)) : row.size;
      const angle = body.angle !== undefined ? (body.angle == null ? null : Number(body.angle)) : row.angle;
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
          const map = textJson ? JSON.parse(textJson) : {};
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
        `UPDATE bubbles SET x = ?, y = ?, variant = ?, tail = ?, size = ?, angle = ?, text_en = ?, text_json = ?, extra_json = ?, updated_at = ?
         WHERE id = ?`
      )
        .bind(x, y, variant, tail, size, angle, textEn, textJson, extraJson, ts, row.id)
        .run();
      const next = await env.DB.prepare("SELECT * FROM bubbles WHERE id = ?").bind(row.id).first();
      return json(mapBubble(next), 200, cors);
    }
  }

  return json({ error: "not found" }, 404, cors);
}

export { publicWord, readerConfigFromToon };

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const origin = request.headers.get("Origin");
    if (origin && !cors["Access-Control-Allow-Origin"]) {
      return json({ error: "forbidden origin" }, 403, cors);
    }

    const path = new URL(request.url).pathname.replace(/\/$/, "") || "/";
    try {
      const session = isPublicRoute(request.method, path) ? null : await userFromRequest(request, env);
      if (!isPublicRoute(request.method, path) && !session) {
        return json({ error: "unauthorized" }, 401, cors);
      }
      return await handle(request, env, cors, session);
    } catch (err) {
      return json({ error: err && err.message ? err.message : "server error" }, 500, cors);
    }
  },
};
