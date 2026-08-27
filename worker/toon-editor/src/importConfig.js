/** config.json (reader shape) → rows the editor D1 stores. */

const CORE = new Set(["x", "y", "variant", "tail", "size", "angle", "text"]);

export function wordToRow(w, sort) {
  const text = typeof w.text === "string" ? { en: w.text } : { ...(w.text || {}) };
  const textEn = String(text.en || text.it || text.de || text.fr || "");
  const extra = {};
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

export function rowToWord(row) {
  let text = { en: row.text_en || row.textEn || "" };
  if (row.text_json || row.textJson) {
    try {
      text = JSON.parse(row.text_json || row.textJson);
    } catch {
      /* keep en fallback */
    }
  }
  const word = {
    x: row.x,
    y: row.y,
    variant: row.variant,
    text,
  };
  if (row.tail) word.tail = row.tail;
  if (row.size != null) word.size = row.size;
  if (row.angle != null) word.angle = row.angle;
  const extraRaw = row.extra_json || row.extraJson;
  if (extraRaw) {
    try {
      Object.assign(word, JSON.parse(extraRaw));
    } catch {
      /* ignore */
    }
  }
  return word;
}

export function configToImport(config, meta) {
  const pages = (config.pages || []).map((page, i) => ({
    position: i,
    file: page.file,
    words: (page.words || []).map((w, s) => wordToRow(w, s)),
  }));
  const extra = {};
  if (config.defaultLang) extra.defaultLang = config.defaultLang;
  if (config.languages) extra.languages = config.languages;
  if (config.reverb) extra.reverb = config.reverb;
  return {
    slug: meta.slug,
    title: String(config.title || meta.title || meta.slug),
    subtitle: String(meta.subtitle || ""),
    description: String(meta.description || ""),
    coverKey: meta.coverKey || null,
    assetPageDir: meta.assetPageDir || null,
    readerUrl: meta.readerUrl || null,
    status: meta.status || "published",
    seriesKey: meta.seriesKey || null,
    episodeN: meta.episodeN != null ? Number(meta.episodeN) : null,
    designWidth: Number(config.designWidth || meta.designWidth || 1152),
    designHeight: Number(config.designHeight || meta.designHeight || 1728),
    extraJson: Object.keys(extra).length ? JSON.stringify(extra) : null,
    pages,
  };
}
