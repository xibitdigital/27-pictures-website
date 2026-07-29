// @ts-nocheck — imperative DOM port; public API typed in types.ts
/**
 * Caption overlays for ToonBook pages (Jax today; injectable sound + lang storage).
 */
import type {
  LangCode,
  LangOption,
  SoundGate,
  WordEntry,
  WordOverlayOptions,
  WordsConfig,
} from "./types";

/** Default localStorage key (legacy Jax). Override via WordOverlayOptions.langStorageKey. */
export const LANG_STORAGE_KEY = "jax-toon-lang";

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/**
 * Normalize coordinate: if value > 1 treat as design pixels, else fraction.
 */
export function toFraction(value: number | null | undefined, designSize: number): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const n = Number(value);
  if (n > 1) return clamp01(n / designSize);
  return clamp01(n);
}

/** Deterministic 0–1 PRNG from string/number seed */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts: Array<string | number | null | undefined>): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Sketchy rounded-rect path in viewBox units (0–100 x, 0–80 y) with optional tail.
 * @param {'none'|'bottom'|'bottom-left'|'bottom-right'|'left'|'right'} tail
 */
function sketchyBubblePath(tail, seed) {
  const rnd = mulberry32(seed || 1);
  const j = (amp) => (rnd() - 0.5) * 2 * amp;

  // Wobbly points around a rounded bubble body
  const pts = [
    [12 + j(2), 18 + j(2)],
    [28 + j(2), 8 + j(1.5)],
    [50 + j(2), 6 + j(1.5)],
    [72 + j(2), 9 + j(1.5)],
    [88 + j(2), 18 + j(2)],
    [94 + j(1.5), 36 + j(2)],
    [92 + j(1.5), 54 + j(2)],
    [78 + j(2), 68 + j(1.5)],
    [55 + j(2), 72 + j(1.5)],
    [32 + j(2), 70 + j(1.5)],
    [14 + j(2), 58 + j(2)],
    [8 + j(1.5), 38 + j(2)],
  ];

  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const mx = (prev[0] + cur[0]) / 2 + j(1.2);
    const my = (prev[1] + cur[1]) / 2 + j(1.2);
    d += ` Q ${mx.toFixed(2)} ${my.toFixed(2)} ${cur[0].toFixed(2)} ${cur[1].toFixed(2)}`;
  }
  // close body
  const last = pts[pts.length - 1];
  const first = pts[0];
  d += ` Q ${((last[0] + first[0]) / 2 + j(1)).toFixed(2)} ${((last[1] + first[1]) / 2 + j(1)).toFixed(2)} ${first[0].toFixed(2)} ${first[1].toFixed(2)} Z`;

  const t = tail || "bottom";
  if (t === "none") return d;

  // Sketchy speech tail
  if (t === "bottom" || t === "bottom-left" || t === "bottom-right") {
    const cx = t === "bottom-left" ? 32 : t === "bottom-right" ? 68 : 50;
    d += ` M ${(cx - 7 + j(1)).toFixed(2)} 68 Q ${(cx + j(2)).toFixed(2)} 78 ${(cx - 2 + j(2)).toFixed(2)} 92 L ${(cx + 8 + j(2)).toFixed(2)} 70 Z`;
  } else if (t === "left") {
    d += ` M 12 40 Q 4 48 -2 52 L 14 56 Z`;
  } else if (t === "right") {
    d += ` M 88 40 Q 96 48 102 52 L 86 56 Z`;
  }

  return d;
}

/**
 * Rough torn-paper rectangle path (viewBox 0-100 x 0-100) — no tail.
 * Used for "AI dialogue" caption boxes ("COMBAT MODE ACTIVATED" style).
 * @param {number} [seed]
 * @param {{ amp?: number, corner?: number, segments?: number, bow?: number }} [opts]
 */
function jaggedBoxPath(seed, opts) {
  const rnd = mulberry32(seed || 1);
  const j = (amp) => (rnd() - 0.5) * 2 * amp;
  const amp = opts && opts.amp != null ? opts.amp : 3.5;
  const corner = opts && opts.corner != null ? opts.corner : 3;
  const segments = opts && opts.segments != null ? opts.segments : 6;
  const bow = opts && opts.bow != null ? opts.bow : 1.4;

  // Points per edge, wobbled off the straight line — hand-brushed, not ruled
  function edge(x0, y0, x1, y1, edgeAmp, segs) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      let x = x0 + (x1 - x0) * t;
      let y = y0 + (y1 - y0) * t;
      if (i > 0 && i < segs) {
        x += j(edgeAmp);
        y += j(edgeAmp);
      }
      pts.push([x, y]);
    }
    return pts;
  }

  const tl = [4 + j(corner), 6 + j(corner)];
  const tr = [96 + j(corner), 6 + j(corner)];
  const br = [96 + j(corner), 94 + j(corner)];
  const bl = [4 + j(corner), 94 + j(corner)];

  const pts = [
    ...edge(tl[0], tl[1], tr[0], tr[1], amp, segments),
    ...edge(tr[0], tr[1], br[0], br[1], amp, segments).slice(1),
    ...edge(br[0], br[1], bl[0], bl[1], amp, segments).slice(1),
    ...edge(bl[0], bl[1], tl[0], tl[1], amp, segments).slice(1),
  ];

  // Sketchy pass: connect wobbled points with slightly bowed curves instead of
  // ruler-straight lines, so each edge reads as a rough hand-drawn stroke.
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const mx = (prev[0] + cur[0]) / 2 + j(bow);
    const my = (prev[1] + cur[1]) / 2 + j(bow);
    d += ` Q ${mx.toFixed(2)} ${my.toFixed(2)} ${cur[0].toFixed(2)} ${cur[1].toFixed(2)}`;
  }
  d += " Z";
  return d;
}

/** Near-rect HUD frame — light hand wobble, no wild overshoots. */
function cleanBoxPath(seed) {
  return jaggedBoxPath(seed, { amp: 0.9, corner: 0.8, segments: 4, bow: 0.35 });
}

/**
 * Jagged star-burst outline (viewBox 0-100 x 0-100) — no tail. Used for
 * shouted lines/impact captions ("TOO SLOW, MAN!" comic burst style).
 */
function starBurstPath(seed, points) {
  const rnd = mulberry32(seed || 1);
  const n = points || 13;
  const total = n * 2;
  const cx = 50;
  const cy = 50;
  const outerR = 48;
  const innerR = 27;

  const pts = [];
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const baseR = i % 2 === 0 ? outerR : innerR;
    // Jitter only adds size (never subtracts) so every outer tip reaches
    // at least `outerR` — with preserveAspectRatio:none stretching this
    // non-uniformly to fit the (often very wide) text box, an undershoot
    // here left gaps at the horizontal extremes where dark text sat over
    // dark art with no white fill behind it, reading as "clipped" text.
    const r = baseR + rnd() * (baseR * 0.12);
    const a = angle + (rnd() - 0.5) * 2 * ((Math.PI / total) * 0.4);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }

  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;
  }
  d += " Z";
  return d;
}

/**
 * Short overshooting scratch strokes fired outward from the box perimeter —
 * the crosshatched marker spikes around a hand-scrawled panel caption.
 */
function scribbleScratches(seed, count) {
  const rnd = mulberry32(seed || 1);
  const bounds = { x0: 4, y0: 6, x1: 96, y1: 94 };
  const scratches = [];

  for (let i = 0; i < count; i++) {
    const edgeIdx = Math.floor(rnd() * 4);
    const t = 0.06 + rnd() * 0.88;
    let x, y, nx, ny;
    if (edgeIdx === 0) {
      x = bounds.x0 + (bounds.x1 - bounds.x0) * t;
      y = bounds.y0;
      nx = 0;
      ny = -1;
    } else if (edgeIdx === 1) {
      x = bounds.x1;
      y = bounds.y0 + (bounds.y1 - bounds.y0) * t;
      nx = 1;
      ny = 0;
    } else if (edgeIdx === 2) {
      x = bounds.x0 + (bounds.x1 - bounds.x0) * t;
      y = bounds.y1;
      nx = 0;
      ny = 1;
    } else {
      x = bounds.x0;
      y = bounds.y0 + (bounds.y1 - bounds.y0) * t;
      nx = -1;
      ny = 0;
    }

    const angle = Math.atan2(ny, nx) + (rnd() - 0.5) * 1.7;
    const len = 6 + rnd() * 14;
    const wobble = () => (rnd() - 0.5) * 3;

    const sx = x - nx * (3 + rnd() * 5);
    const sy = y - ny * (3 + rnd() * 5);
    const mx = x + Math.cos(angle) * len * 0.5 + wobble();
    const my = y + Math.sin(angle) * len * 0.5 + wobble();
    const ex = x + Math.cos(angle) * len + wobble();
    const ey = y + Math.sin(angle) * len + wobble();

    scratches.push(
      `M ${sx.toFixed(2)} ${sy.toFixed(2)} L ${mx.toFixed(2)} ${my.toFixed(2)} L ${ex.toFixed(2)} ${ey.toFixed(2)}`
    );
  }
  return scratches;
}

const CAN_HOVER =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Default gate: allow playback (used in tests / pages without a sound UI). */
const DEFAULT_SOUND_GATE: SoundGate = {
  isEnabled: () => true,
};

/** Play a word's SFX clip. Fresh Audio() per play so rapid re-triggers overlap. */
function playSfx(url: string, sound: SoundGate): void {
  if (!sound.isEnabled()) {
    sound.onBlockedPlay?.();
    return;
  }
  try {
    const audio = new Audio(url);
    audio.play().catch(() => {});
  } catch (_) {
    /* ignore */
  }
}

function resolveVariant(w) {
  const v = (w.variant || w.mode || "plain").toString().toLowerCase();
  if (v === "ai" || v === "hud" || v === "terminal" || v === "caption") return "ai";
  if (v === "burst" || v === "spiky" || v === "star" || v === "shout") return "burst";
  if (v === "bubble" || v === "dialog" || v === "speech") return "bubble";
  if (v === "credit" || v === "credits") return "credit";
  return "plain";
}

function resolveBubbleStyle(w, variant) {
  const b = w.bubble && typeof w.bubble === "object" ? w.bubble : {};
  const isAi = variant === "ai";
  const isBurst = variant === "burst";
  const shape = (b.shape || w.bubbleShape || (isAi ? "box" : isBurst ? "star" : "organic"))
    .toString()
    .toLowerCase();
  const isClean = shape === "clean" || shape === "frame" || shape === "rect";
  return {
    shape,
    fill: b.fill || w.bubbleFill || (isAi ? "#0a0a0a" : "#ffffff"),
    stroke: b.stroke || w.bubbleStroke || (isAi ? "#0a0a0a" : "#111111"),
    strokeWidth:
      b.strokeWidth != null
        ? Number(b.strokeWidth)
        : w.bubbleStrokeWidth != null
          ? Number(w.bubbleStrokeWidth)
          : isAi
            ? 2.2
            : isBurst
              ? 3
              : 2.4,
    tail: b.tail || w.tail || (isAi || isBurst ? "none" : "bottom"),
    padX: b.padX != null ? Number(b.padX) : isAi ? 0.7 : isBurst ? 1.1 : 0.55,
    padY: b.padY != null ? Number(b.padY) : isAi ? 0.5 : isBurst ? 0.9 : 0.4,
    // Sketchy multi-pass defaults for torn "box"; clean HUD frame is a single stroke.
    retrace: b.retrace != null ? Number(b.retrace) : isClean ? 0 : shape === "box" ? 2 : 0,
    scratches: b.scratches != null ? Number(b.scratches) : isClean ? 0 : shape === "box" ? 10 : 0,
  };
}

function boxPathForShape(shape, seed) {
  if (shape === "clean" || shape === "frame" || shape === "rect") return cleanBoxPath(seed);
  return jaggedBoxPath(seed);
}

function createBubbleChrome(seed, bubbleStyle, designScale) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "jax-bubble-svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const shape = bubbleStyle.shape;
  const isBoxy = shape === "box" || shape === "clean" || shape === "frame" || shape === "rect";
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    isBoxy
      ? boxPathForShape(shape, seed)
      : shape === "star"
        ? starBurstPath(seed)
        : sketchyBubblePath(bubbleStyle.tail, seed)
  );
  path.setAttribute("fill", bubbleStyle.fill);
  path.setAttribute("stroke", bubbleStyle.stroke);
  const sw = Math.max(1.2, (bubbleStyle.strokeWidth || 2.4) * Math.min(1.4, designScale * 1.1));
  path.setAttribute("stroke-width", String(sw));
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.appendChild(path);

  if (isBoxy) {
    const retraceN = Math.max(0, Math.min(3, bubbleStyle.retrace | 0));
    // Extra unfilled passes — hand re-tracing the marker outline (sketchy boxes only).
    for (let i = 0; i < retraceN; i++) {
      const retrace = document.createElementNS("http://www.w3.org/2000/svg", "path");
      retrace.setAttribute("d", boxPathForShape(shape, (seed || 1) + 97 + i * 114));
      retrace.setAttribute("fill", "none");
      retrace.setAttribute("stroke", bubbleStyle.stroke);
      retrace.setAttribute("stroke-width", String(Math.max(0.8, sw * (0.65 - i * 0.15))));
      retrace.setAttribute("stroke-linejoin", "round");
      retrace.setAttribute("stroke-linecap", "round");
      retrace.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(retrace);
    }

    const scratchN = Math.max(0, Math.min(16, bubbleStyle.scratches | 0));
    if (scratchN > 0) {
      // Crosshatched scratch spikes shooting past the border (sketchy boxes only).
      scribbleScratches((seed || 1) + 401, scratchN).forEach((d, i) => {
        const scratch = document.createElementNS("http://www.w3.org/2000/svg", "path");
        scratch.setAttribute("d", d);
        scratch.setAttribute("fill", "none");
        scratch.setAttribute("stroke", bubbleStyle.stroke);
        scratch.setAttribute("stroke-width", String(Math.max(0.9, sw * (0.4 + (i % 3) * 0.18))));
        scratch.setAttribute("stroke-linecap", "round");
        scratch.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(scratch);
      });
    }
  }

  return svg;
}

/**
 * Content box of an object-fit:contain image inside its offset parent slot.
 */
export function imageContentBox(img: HTMLImageElement): {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
} {
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  const cw = img.clientWidth;
  const ch = img.clientHeight;
  const scale = Math.min(cw / nw, ch / nh);
  const width = nw * scale;
  const height = nh * scale;
  const left = (cw - width) / 2;
  const top = (ch - height) / 2;
  return { left, top, width, height, scale };
}

function resolveText(entry, lang) {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  if (entry.text) {
    if (typeof entry.text === "string") return entry.text;
    return entry.text[lang] || entry.text.en || entry.text.it || entry.text.de || entry.text.fr || "";
  }
  return entry[lang] || entry.en || entry.it || entry.de || entry.fr || "";
}

/**
 * Resolve stroke options from a word entry.
 * Accepts:
 *   stroke: "#000", strokeThickness: 2
 *   strokeColor / strokeWidth (aliases)
 *   stroke: { color: "#000", thickness: 2 }  // or width
 * Thickness is in design pixels (scaled to display).
 * @returns {{ color: string, thickness: number }|null}
 */
function resolveStroke(w) {
  if (!w) return null;
  let color = w.strokeColor || null;
  let thickness = w.strokeThickness != null ? Number(w.strokeThickness) : null;

  if (w.strokeWidth != null && thickness == null) thickness = Number(w.strokeWidth);

  if (w.stroke != null) {
    if (typeof w.stroke === "string") {
      color = color || w.stroke;
    } else if (typeof w.stroke === "object") {
      color = color || w.stroke.color || w.stroke.strokeColor || null;
      if (thickness == null) {
        const t = w.stroke.thickness != null ? w.stroke.thickness : w.stroke.width;
        if (t != null) thickness = Number(t);
      }
    }
  }

  if (!color || thickness == null || Number.isNaN(thickness) || thickness <= 0) {
    // If only color is set, use a small default thickness; if only thickness, default black
    if (color && (thickness == null || Number.isNaN(thickness))) thickness = 1.5;
    else if (thickness > 0 && !color) color = "#000000";
    else return null;
  }

  return { color, thickness };
}

/**
 * @typedef {Object} WordEntry
 * @property {number} x - 0–1 fraction or design px
 * @property {number} y - 0–1 fraction or design px
 * @property {'left'|'center'|'right'} [align]
 * @property {number} [size] - design-pixel font size (scaled to display)
 * @property {string} [color] - fill color
 * @property {string|Object} [stroke] - outline color string, or { color, thickness|width }
 * @property {string} [strokeColor] - outline color
 * @property {number} [strokeThickness] - outline width in design px
 * @property {number} [strokeWidth] - alias of strokeThickness
 * @property {number} [maxWidth] - 0–1 fraction of page width
 * @property {number} [angle] - rotation in degrees (clockwise positive)
 * @property {number} [rotate] - alias of angle
 * @property {number} [scale] - uniform size multiplier (1 = no change) for the bubble/ai/burst
 *   background shape only — text size is unaffected; ignored on plain (non-bubble) words
 * @property {'plain'|'bubble'} [variant] - "bubble" = sketchy dialog balloon
 * @property {'plain'|'bubble'} [mode] - alias of variant
 * @property {string} [tail] - bubble tail: none|bottom|bottom-left|bottom-right|left|right
 * @property {Object} [bubble] - { fill, stroke, strokeWidth, tail, padX, padY }
 * @property {Object|string} text - { en, it, de, fr } or string
 */

export class WordOverlay {
  designWidth: number;
  designHeight: number;
  pages: Record<string, WordEntry[]>;
  languages: LangOption[];
  defaultLang: LangCode;
  fontFamily: string;
  lang: LangCode;
  sound: SoundGate;
  langStorageKey: string;
  _observers: WeakMap<HTMLElement, ResizeObserver>;

  constructor(config: WordsConfig, options: WordOverlayOptions = {}) {
    this.designWidth = config.designWidth || 1008;
    this.designHeight = config.designHeight || 1792;
    this.pages = config.pages || {};
    this.languages = config.languages || [
      { code: "en", label: "EN" },
      { code: "it", label: "IT" },
      { code: "de", label: "DE" },
      { code: "fr", label: "FR" },
    ];
    this.defaultLang = config.defaultLang || "en";
    this.fontFamily = config.fontFamily || '"Bangers", cursive';
    this.sound = options.sound || DEFAULT_SOUND_GATE;
    this.langStorageKey = options.langStorageKey || LANG_STORAGE_KEY;
    this.lang = this._readStoredLang() || this.defaultLang;
    this._observers = new WeakMap();
  }

  _readStoredLang(): LangCode | null {
    try {
      const v = localStorage.getItem(this.langStorageKey);
      if (v && this.languages.some((l) => l.code === v)) return v;
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  _storeLang(code: LangCode): void {
    try {
      localStorage.setItem(this.langStorageKey, code);
    } catch (_) {
      /* ignore */
    }
  }

  setLang(code: LangCode): void {
    if (!this.languages.some((l) => l.code === code)) return;
    this.lang = code;
    this._storeLang(code);
  }

  getLang(): LangCode {
    return this.lang;
  }

  getLanguages(): LangOption[] {
    return this.languages.slice();
  }

  wordsForPage(pageNum: number): WordEntry[] {
    const key = String(pageNum);
    return this.pages[key] || this.pages[pageNum] || [];
  }

  /**
   * Render word layer into a page slot that already contains an <img>.
   * @param {HTMLElement} slot
   * @param {number|null} pageNum 1-based; null clears overlays
   */
  render(slot: HTMLElement | null, pageNum: number | null): void {
    if (!slot) return;
    Array.from(slot.children).forEach((n) => {
      if (n.classList?.contains("jax-word-layer")) n.remove();
    });

    if (pageNum == null) return;
    const img = Array.from(slot.children).find(
      (n): n is HTMLImageElement => n.tagName === "IMG"
    );
    if (!img) return;

    const words = this.wordsForPage(pageNum);
    if (!words.length) return;

    const layer = document.createElement("div");
    layer.className = "jax-word-layer";
    layer.setAttribute("aria-hidden", "true");
    slot.appendChild(layer);

    const paint = () => {
      if (!img.isConnected || !layer.isConnected) return;
      const box = imageContentBox(img);
      layer.style.cssText = [
        "position:absolute",
        `left:${box.left}px`,
        `top:${box.top}px`,
        `width:${box.width}px`,
        `height:${box.height}px`,
        "pointer-events:none",
        "overflow:visible",
        // Above .nav-zone (z-index:30, covers the full page for turn
        // clicks) so word hover/click targets actually receive events.
        "z-index:35",
      ].join(";");

      layer.innerHTML = "";
      const designScale = box.width / this.designWidth;

      words.forEach((w, wordIndex) => {
        const text = resolveText(w, this.lang);
        if (!text) return;

        const x = toFraction(w.x, this.designWidth);
        const y = toFraction(w.y, this.designHeight);
        const align = w.align || "center";
        const sizePx = (w.size != null ? Number(w.size) : 22) * designScale;
        const maxW = w.maxWidth != null ? (w.maxWidth > 1 ? w.maxWidth / this.designWidth : w.maxWidth) * 100 : null;
        const variant = resolveVariant(w);
        const isBubble = variant === "bubble" || variant === "ai" || variant === "burst";
        const isCredit = variant === "credit";

        const el = document.createElement("div");
        // Leading spaces on optional classes — never glue names together
        // (e.g. "jax-word--bubblejax-word--burst" broke burst/AI CSS).
        const bubbleVariantClass =
          variant === "ai" ? " jax-word--ai" : variant === "burst" ? " jax-word--burst" : "";
        el.className = [
          isBubble ? "jax-word jax-word--bubble" : "jax-word",
          bubbleVariantClass,
          isCredit ? "jax-word--credit" : "",
          w.audio ? "jax-word--sfx" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const textEl = document.createElement("span");
        textEl.className = "jax-word-text";
        textEl.textContent = text;

        if (isBubble) {
          const bubbleStyle = resolveBubbleStyle(w, variant);
          const seed = hashSeed(pageNum, wordIndex, text, w.x, w.y, bubbleStyle.tail);
          const chrome = createBubbleChrome(seed, bubbleStyle, designScale);
          const bubbleScale = w.scale != null ? Number(w.scale) : 1;
          if (bubbleScale && bubbleScale !== 1 && !Number.isNaN(bubbleScale)) {
            // Scale only the bubble background shape, not the text on top.
            chrome.style.transform = `scale(${bubbleScale})`;
            chrome.style.transformOrigin = "center";
          }
          el.appendChild(chrome);
          el.appendChild(textEl);
          el.dataset.tail = bubbleStyle.tail;
          // Bubble text defaults to dark ink; AI caption boxes default to white
          textEl.style.color = w.color || (variant === "ai" ? "#f5f5f5" : "#111111");
          const padX = `${bubbleStyle.padX}em`;
          const padY = `${bubbleStyle.padY}em`;
          textEl.style.padding = `${padY} ${padX} ${bubbleStyle.tail === "none" ? padY : `calc(${padY} + 0.35em)`} ${padX}`;
        } else {
          el.appendChild(textEl);
        }

        const transform = [];
        if (align === "center") transform.push("translate(-50%, -50%)");
        else if (align === "right") transform.push("translate(-100%, -50%)");
        else transform.push("translate(0, -50%)");
        const angle = w.angle != null ? Number(w.angle) : w.rotate != null ? Number(w.rotate) : 0;
        if (angle && !Number.isNaN(angle)) transform.push(`rotate(${angle}deg)`);

        const stroke = resolveStroke(w);
        const strokeCss = [];
        // Text stroke applies to the text span (bubbles often skip heavy text stroke)
        if (stroke && !isBubble) {
          const strokePx = Math.max(0.5, stroke.thickness * designScale);
          strokeCss.push(`-webkit-text-stroke:${strokePx}px ${stroke.color}`);
          strokeCss.push(`paint-order:stroke fill`);
          strokeCss.push(`text-stroke:${strokePx}px ${stroke.color}`);
        } else if (stroke && isBubble) {
          const strokePx = Math.max(0.4, stroke.thickness * designScale * 0.65);
          textEl.style.webkitTextStroke = `${strokePx}px ${stroke.color}`;
          textEl.style.paintOrder = "stroke fill";
        }

        const textAlign = align === "right" ? "right" : align === "left" ? "left" : "center";

        const fontFamily = isCredit
          ? '"Inter", sans-serif'
          : w.fontFamily || this.fontFamily;
        el.style.cssText = [
          "position:absolute",
          `left:${x * 100}%`,
          `top:${y * 100}%`,
          // Base position/rotation lives in a custom property, not the
          // `transform` shorthand itself, so the CSS hover-zoom rule can
          // append `scale()` without clobbering placement.
          `--jax-transform:${transform.join(" ")}`,
          `font-family:${fontFamily}`,
          `font-size:${Math.max(10, sizePx)}px`,
          isCredit ? "line-height:1.45" : "line-height:1.15",
          isCredit ? "font-weight:400" : "font-weight:700",
          isBubble ? "" : `color:${w.color || "#fff"}`,
          "white-space:pre-line",
          "text-align:" + textAlign,
          maxW != null ? `max-width:${maxW}%` : "",
          ...strokeCss,
          isCredit ? "letter-spacing:0.06em" : "letter-spacing:0.02em",
          isCredit ? "text-transform:none" : "",
          w.audio ? "pointer-events:auto" : "",
          w.audio ? "cursor:pointer" : "",
        ]
          .filter(Boolean)
          .join(";");

        if (!isBubble) {
          textEl.style.cssText = strokeCss.concat([`color:${w.color || "#fff"}`]).join(";");
        }

        if (w.audio) {
          const url = w.audio;
          const sound = this.sound;
          const play = (ev) => {
            ev.stopPropagation();
            playSfx(url, sound);
          };
          // Desktop mouse: play on hover. Touch (no hover): play on tap.
          if (CAN_HOVER) el.addEventListener("mouseenter", play);
          el.addEventListener("click", play);
        }

        layer.appendChild(el);
      });
    };

    if (img.complete && img.naturalWidth) paint();
    else img.addEventListener("load", paint, { once: true });

    // Reposition on resize / layout changes
    if (typeof ResizeObserver !== "undefined") {
      const prev = this._observers.get(slot);
      if (prev) prev.disconnect();
      const ro = new ResizeObserver(() => paint());
      ro.observe(slot);
      if (img) ro.observe(img);
      this._observers.set(slot, ro);
    }
  }

  /**
   * Re-render caption layers for the given page slots (pass explicit elements — no querySelector).
   */
  refreshSlots(slots: Array<HTMLElement | null | undefined>): void {
    for (const slot of slots) {
      if (!slot) continue;
      const n = Number(slot.dataset.pageNum);
      if (n) this.render(slot, n);
      else this.render(slot, null);
    }
  }
}

export async function loadWords(url?: string): Promise<WordsConfig> {
  const res = await fetch(url || "words.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`words.json ${res.status}`);
  return (await res.json()) as WordsConfig;
}
