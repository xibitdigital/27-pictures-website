// @ts-nocheck — imperative DOM port; public API typed in types.ts
/**
 * Caption overlays for ToonBook pages (Jax today; injectable sound + lang storage).
 */
import { resolveAssetUrl } from "./assetUrl";
import { hashSeed, resolveBubbleStyle, resolveBubbleVariantClass, createBubbleChrome } from "./bubbles";
import { loadConfig } from "./loadConfig";
import type { LangCode, LangOption, SoundGate, WordEntry, WordOverlayOptions, WordsConfig } from "./types";

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

/** Default gate: allow playback (used in tests / pages without a sound UI). */
const DEFAULT_SOUND_GATE: SoundGate = {
  isEnabled: () => true,
};

/** Play a word's SFX clip. Fresh Audio() per play so rapid re-triggers overlap. */
function playSfx(url: string, sound: SoundGate, volume = 1): void {
  if (!sound.isEnabled()) {
    // First blocked tap may show the enable prompt once; later taps stay quiet.
    sound.onBlockedPlay?.();
    return;
  }
  try {
    const audio = new Audio(url);
    // Clamp — HTMLAudioElement.volume is 0–1; use hotter source files for “louder”.
    const v = Number(volume);
    audio.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
    audio.play().catch(() => {});
  } catch (_) {
    /* ignore */
  }
}

/** Map a config `variant`/`mode` string (plus aliases) to a canonical variant. */
export function resolveVariant(w) {
  const v = (w.variant || w.mode || "plain").toString().toLowerCase();
  if (v === "badai" || v === "bad-ai" || v === "ai-inverted" || v === "ai-bad") return "badai";
  if (v === "ai" || v === "hud" || v === "terminal" || v === "caption") return "ai";
  if (v === "burst" || v === "spiky" || v === "star" || v === "shout") return "burst";
  // Before "bubble": a thought bubble is a bubble with a dotted trail instead of
  // a pointed lobe. Missing this case dropped it all the way to "plain".
  if (v === "thought" || v === "think" || v === "cloud") return "thought";
  if (v === "bubble" || v === "dialog" || v === "speech") return "bubble";
  if (v === "credit" || v === "credits") return "credit";
  return "plain";
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
function resolveStroke(w: WordEntry) {
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
 * @property {string} [tail] - bubble tail: none|bottom|bottom-left|bottom-right|top|top-left|top-right|left|right
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
    // Normalize pages[] → map of 1-based page → words for fast lookup.
    this.pages = {};
    const list = Array.isArray(config.pages) ? config.pages : [];
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      const words = entry && Array.isArray(entry.words) ? entry.words : [];
      this.pages[String(i + 1)] = words;
    }
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

    const clearLayers = (): void => {
      Array.from(slot.children).forEach((n) => {
        if (n.classList?.contains("jax-word-layer")) n.remove();
      });
      slot.classList.remove("is-captions-pending");
    };

    if (pageNum == null) {
      clearLayers();
      return;
    }

    const img = Array.from(slot.children).find(
      (n): n is HTMLImageElement => n.tagName === "IMG" && !n.classList.contains("cover-texture-img")
    );
    if (!img) {
      clearLayers();
      return;
    }

    const words = this.wordsForPage(pageNum);
    if (!words.length) {
      clearLayers();
      return;
    }

    // Hide the plate until captions are ready so flip settles don’t flash bare art.
    slot.classList.add("is-captions-pending");

    let painted = false;
    const paint = () => {
      if (painted || !img.isConnected || !slot.isConnected) return;
      // Need layout size — natural dims for contain box; fall back to client box.
      if (!img.naturalWidth && !img.clientWidth) return;
      painted = true;

      const layer = document.createElement("div");
      layer.className = "jax-word-layer";
      layer.setAttribute("aria-hidden", "true");

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
        const isBubble =
          variant === "bubble" ||
          variant === "thought" ||
          variant === "ai" ||
          variant === "badai" ||
          variant === "burst";
        const isCredit = variant === "credit";

        const el = document.createElement("div");
        // Leading spaces on optional classes — never glue names together
        // (e.g. "jax-word--bubblejax-word--burst" broke burst/AI CSS).
        const bubbleVariantClass = resolveBubbleVariantClass(variant);
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
          // Bubble text: organic/burst/badai = dark ink; good AI HUD = white
          textEl.style.color = w.color || (variant === "ai" ? "#f5f5f5" : variant === "badai" ? "#0a0a0a" : "#111111");
          const padX = `${bubbleStyle.padX}em`;
          const padY = `${bubbleStyle.padY}em`;
          // The tail eats into the balloon on its own side, so pad that side out.
          // Thought bubbles have no lobe (dotted trail sits fully outside the
          // body), so they take no tail padding and no side offset.
          const tailPad = `calc(${padY} + 0.35em)`;
          const hasLobe = bubbleStyle.tail !== "none" && bubbleStyle.shape !== "thought";
          const isTopTail = hasLobe && bubbleStyle.tail.startsWith("top");
          textEl.style.padding = `${isTopTail ? tailPad : padY} ${padX} ${
            hasLobe && !isTopTail ? tailPad : padY
          } ${padX}`;
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

        // Bubbles (and any word with SFX) must capture hits — the layer uses
        // pointer-events:none so unhandled clicks fall through to .nav-zone
        // (z-index 30, full-page turn areas) and flip the page.
        const interactive = isBubble || !!w.audio;

        // Credit uses the same face as AI/comic captions (toon fontFamily / Bangers).
        const fontFamily = w.fontFamily || this.fontFamily;
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
          isCredit ? "line-height:1.35" : "line-height:1.15",
          isCredit ? "font-weight:400" : "font-weight:700",
          // Credit color is owned by .jax-word--credit CSS (end-card readable).
          // Inline var(--silver) was too faint on black footers.
          isBubble || isCredit ? "" : `color:${w.color || "#fff"}`,
          "white-space:pre-line",
          "text-align:" + textAlign,
          maxW != null ? `max-width:${maxW}%` : "",
          ...strokeCss,
          isCredit ? "letter-spacing:0.06em" : "letter-spacing:0.02em",
          isCredit ? "text-transform:none" : "",
          interactive ? "pointer-events:auto" : "",
          w.audio ? "cursor:pointer" : "",
        ]
          .filter(Boolean)
          .join(";");

        if (!isBubble) {
          textEl.style.cssText = strokeCss.concat([`color:${w.color || "#fff"}`]).join(";");
        }

        if (interactive) {
          const url = w.audio;
          const sound = this.sound;
          const vol = w.volume != null ? Number(w.volume) : 1;
          // Always stopPropagation so .nav-zone (sibling under the spread)
          // does not treat a bubble/SFX hit as a page turn.
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            if (url) playSfx(url, sound, vol);
          });
        }

        layer.appendChild(el);
      });

      // Atomic swap: remove previous captions only when the new layer is ready.
      Array.from(slot.children).forEach((n) => {
        if (n.classList?.contains("jax-word-layer")) n.remove();
      });
      slot.appendChild(layer);
      slot.classList.remove("is-captions-pending");
    };

    if (img.complete && (img.naturalWidth || img.clientWidth)) {
      paint();
    } else {
      img.addEventListener("load", paint, { once: true });
      if (typeof img.decode === "function") {
        img
          .decode()
          .then(paint)
          .catch(() => {
            /* load listener is the fallback */
          });
      }
    }

    // Reposition on resize / layout changes
    if (typeof ResizeObserver !== "undefined") {
      const prev = this._observers.get(slot);
      if (prev) prev.disconnect();
      const ro = new ResizeObserver(() => {
        painted = false;
        paint();
      });
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

/**
 * Resolve page image + word SFX paths through VITE_ASSET_BASE so assets load
 * from R2/CDN when configured (relative paths stay relative when base is empty).
 */
export function resolveWordsAssets(config: WordsConfig, pageDir?: string): WordsConfig {
  if (!Array.isArray(config?.pages)) return config;
  const pages = config.pages.map((page) => {
    const file = page?.file && typeof page.file === "string" ? resolveAssetUrl(page.file.trim(), pageDir) : page?.file;
    const words = Array.isArray(page?.words)
      ? page.words.map((w) => {
          if (!w || typeof w.audio !== "string" || !w.audio.trim()) return w;
          return { ...w, audio: resolveAssetUrl(w.audio.trim(), pageDir) };
        })
      : page?.words;
    return { ...page, file, words };
  });
  return { ...config, pages };
}

/**
 * Load toon config.json and resolve caption SFX paths.
 * Shares fetch cache with the page loader (`loadConfig`) when the same URL is used.
 */
export async function loadWords(url: string, pageDir?: string): Promise<WordsConfig> {
  const config = await loadConfig(url);
  return resolveWordsAssets(config, pageDir);
}
