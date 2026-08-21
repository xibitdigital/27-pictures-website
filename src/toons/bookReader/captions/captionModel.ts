/**
 * Word entries (config) → caption view models (props for WordCaption.vue).
 * Pure: no DOM, no side effects — the components just render what comes out.
 */
import { hashSeed, resolveBubbleStyle, resolveBubbleVariantClass } from "../bubbles";
import type { LangCode, WordEntry } from "../types";
import { buildBubbleChrome, type BubbleChromeModel } from "./bubbleChrome";

export interface CaptionModel {
  key: string;
  index: number;
  text: string;
  classes: string[];
  style: Record<string, string>;
  textStyle: Record<string, string>;
  bubble: BubbleChromeModel | null;
  bubbleStyle: Record<string, string> | null;
  tail: string | null;
  /** Resolved SFX url, if the caption has one. */
  audio: string | null;
  volume: number;
  /** 0–1 position on the plate — auto-read order (top→bottom, then left→right). */
  x: number;
  y: number;
}

export interface CaptionContext {
  lang: LangCode;
  pageNum: number;
  designWidth: number;
  designHeight: number;
  /** Rendered plate width / designWidth. */
  designScale: number;
  fontFamily: string;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Normalize a coordinate: >1 means design pixels, otherwise a 0–1 fraction. */
export function toFraction(value: number | null | undefined, designSize: number): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const n = Number(value);
  if (n > 1) return clamp01(n / designSize);
  return clamp01(n);
}

/** Map a config `variant`/`mode` string (plus aliases) to a canonical variant. */
export function resolveVariant(w: Partial<WordEntry>): string {
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

export function resolveText(entry: WordEntry | string | null | undefined, lang: LangCode): string {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  if (entry.text) {
    if (typeof entry.text === "string") return entry.text;
    return entry.text[lang] || entry.text.en || entry.text.it || entry.text.de || entry.text.fr || "";
  }
  const map = entry as unknown as Record<string, string | undefined>;
  return map[lang] || map.en || map.it || map.de || map.fr || "";
}

/**
 * Stroke options from a word entry. Accepts `stroke`/`strokeColor`/
 * `strokeThickness`/`strokeWidth`, or `stroke: { color, thickness|width }`.
 * Thickness is design pixels (scaled to display by the caller).
 */
export function resolveStroke(w: WordEntry): { color: string; thickness: number } | null {
  if (!w) return null;
  let color = w.strokeColor || null;
  let thickness = w.strokeThickness != null ? Number(w.strokeThickness) : null;

  if (w.strokeWidth != null && thickness == null) thickness = Number(w.strokeWidth);

  if (w.stroke != null) {
    if (typeof w.stroke === "string") {
      color = color || w.stroke;
    } else if (typeof w.stroke === "object") {
      const s = w.stroke as Record<string, unknown>;
      color = color || (s.color as string) || (s.strokeColor as string) || null;
      if (thickness == null) {
        const t = s.thickness != null ? s.thickness : s.width;
        if (t != null) thickness = Number(t);
      }
    }
  }

  if (!color || thickness == null || Number.isNaN(thickness) || thickness <= 0) {
    // Only a color → small default thickness; only a thickness → black.
    if (color && (thickness == null || Number.isNaN(thickness))) thickness = 1.5;
    else if (thickness != null && thickness > 0 && !color) color = "#000000";
    else return null;
  }

  return { color: color as string, thickness: thickness as number };
}

/** Content box of an object-fit:contain image inside its offset parent slot. */
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

/**
 * Type size when the config does not say. Onomatopoeia are drawn larger than
 * speech by convention, and HUD readouts a shade smaller than a voice.
 */
export function defaultSize(variant: string): number {
  if (variant === "burst") return 28;
  if (variant === "ai" || variant === "badai") return 20;
  if (variant === "credit") return 18;
  return 22;
}

/**
 * Wrap width for a balloon that does not declare one, in `ch` — the font's own
 * character width, so it tracks the type size and the face instead of a
 * fraction of the plate.
 *
 * A balloon wants roughly two lines: wide enough that a short line never breaks,
 * narrow enough that a long one is not a strip across the page. Half the
 * character count lands there, clamped at both ends, and never narrower than
 * the longest word or that word would break mid-letter.
 *
 * It is a *max*-width, so short text still shrinks to its own content — which is
 * what makes the box self-sizing and the `maxWidth` on every config entry
 * redundant.
 */
export function autoWrapCh(text: string): number {
  const len = text.replace(/\s+/g, " ").trim().length;
  const longestWord = text.split(/\s+/).reduce((n, word) => Math.max(n, word.length), 0);
  return Math.max(Math.min(Math.max(14, Math.ceil(len / 2)), 28), longestWord);
}

/** One word entry → the props WordCaption.vue renders (null = nothing to show). */
export function buildCaption(w: WordEntry, index: number, ctx: CaptionContext): CaptionModel | null {
  const text = resolveText(w, ctx.lang);
  if (!text) return null;

  const x = toFraction(w.x, ctx.designWidth);
  const y = toFraction(w.y, ctx.designHeight);
  const align = w.align || "center";
  const variant = resolveVariant(w);
  const sizePx = (w.size != null ? Number(w.size) : defaultSize(variant)) * ctx.designScale;
  const maxW = w.maxWidth != null ? (w.maxWidth > 1 ? w.maxWidth / ctx.designWidth : w.maxWidth) * 100 : null;
  const isBubble =
    variant === "bubble" || variant === "thought" || variant === "ai" || variant === "badai" || variant === "burst";
  const isCredit = variant === "credit";
  const audio = typeof w.audio === "string" && w.audio.trim() ? w.audio : null;

  const transform: string[] = [];
  if (align === "center") transform.push("translate(-50%, -50%)");
  else if (align === "right") transform.push("translate(-100%, -50%)");
  else transform.push("translate(0, -50%)");
  const angle = w.angle != null ? Number(w.angle) : w.rotate != null ? Number(w.rotate) : 0;
  if (angle && !Number.isNaN(angle)) transform.push(`rotate(${angle}deg)`);

  const stroke = resolveStroke(w);
  const textAlign = align === "right" ? "right" : align === "left" ? "left" : "center";

  const style: Record<string, string> = {
    position: "absolute",
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    // Base position/rotation lives in a custom property, not `transform`, so the
    // hover/speaking CSS can append scale() without clobbering placement.
    "--jax-transform": transform.join(" "),
    "font-family": w.fontFamily || ctx.fontFamily,
    "font-size": `${Math.max(10, sizePx)}px`,
    "line-height": isCredit ? "1.35" : "1.15",
    "font-weight": isCredit ? "400" : "700",
    "white-space": "pre-line",
    "text-align": textAlign,
    "letter-spacing": isCredit ? "0.06em" : "0.02em",
  };
  // Credit color is owned by .jax-word--credit CSS (end-card readable).
  if (!isBubble && !isCredit) style.color = w.color || "#fff";
  // An explicit maxWidth is a fraction of the plate; the automatic one is in
  // `ch`, so it keeps its shape when the same caption is read at another size.
  style["max-width"] = maxW != null ? `${maxW}%` : `${autoWrapCh(text)}ch`;
  if (isCredit) style["text-transform"] = "none";
  // Bubbles (and any word with SFX) must capture hits — the layer is
  // pointer-events:none so stray clicks fall through to .nav-zone (page turn).
  if (isBubble || audio) style["pointer-events"] = "auto";
  if (audio) style.cursor = "pointer";

  const textStyle: Record<string, string> = {};
  let bubble: BubbleChromeModel | null = null;
  let bubbleStyle: Record<string, string> | null = null;
  let tail: string | null = null;

  if (isBubble) {
    const style_ = resolveBubbleStyle(w as unknown as Record<string, unknown>, variant);
    const seed = hashSeed(ctx.pageNum, index, text, w.x, w.y, style_.tail);
    bubble = buildBubbleChrome(seed, style_, ctx.designScale);
    tail = style_.tail;

    const scale = w.scale != null ? Number(w.scale) : 1;
    if (scale && scale !== 1 && !Number.isNaN(scale)) {
      // Scale only the bubble background shape, never the text on top.
      bubbleStyle = { transform: `scale(${scale})`, "transform-origin": "center" };
    }

    // Organic/burst/badai = dark ink; good AI HUD = white.
    textStyle.color = w.color || (variant === "ai" ? "#f5f5f5" : variant === "badai" ? "#0a0a0a" : "#111111");
    const padX = `${style_.padX}em`;
    const padY = `${style_.padY}em`;
    // The tail eats into the balloon on its own side, so pad that side out.
    // Thought bubbles have no lobe (dots sit fully outside), so no tail padding.
    const tailPad = `calc(${padY} + 0.35em)`;
    const hasLobe = style_.tail !== "none" && style_.shape !== "thought";
    const isTopTail = hasLobe && style_.tail.startsWith("top");
    textStyle.padding = `${isTopTail ? tailPad : padY} ${padX} ${hasLobe && !isTopTail ? tailPad : padY} ${padX}`;

    if (stroke) {
      const strokePx = Math.max(0.4, stroke.thickness * ctx.designScale * 0.65);
      textStyle["-webkit-text-stroke"] = `${strokePx}px ${stroke.color}`;
      textStyle["paint-order"] = "stroke fill";
    }
  } else {
    if (stroke) {
      const strokePx = Math.max(0.5, stroke.thickness * ctx.designScale);
      const strokeCss = `${strokePx}px ${stroke.color}`;
      style["-webkit-text-stroke"] = strokeCss;
      style["paint-order"] = "stroke fill";
      style["text-stroke"] = strokeCss;
      textStyle["-webkit-text-stroke"] = strokeCss;
      textStyle["paint-order"] = "stroke fill";
      textStyle["text-stroke"] = strokeCss;
    }
    textStyle.color = w.color || "#fff";
  }

  const classes = ["jax-word"];
  if (isBubble) classes.push("jax-word--bubble");
  const variantClass = resolveBubbleVariantClass(variant);
  if (variantClass) classes.push(variantClass);
  if (isCredit) classes.push("jax-word--credit");
  if (audio) classes.push("jax-word--sfx");

  return {
    key: `${ctx.pageNum}:${index}:${text}`,
    index,
    text,
    classes,
    style,
    textStyle,
    bubble,
    bubbleStyle,
    tail,
    audio,
    volume: w.volume != null ? Number(w.volume) : 1,
    x,
    y,
  };
}

/** All captions of a page, in config order (rendering order). */
export function buildCaptions(words: WordEntry[], ctx: CaptionContext): CaptionModel[] {
  return words.map((w, i) => buildCaption(w, i, ctx)).filter((c): c is CaptionModel => c != null);
}

/**
 * Comic reading order: top→bottom, but captions within ROW_TOLERANCE of each
 * other count as one row and go left→right (two balloons in the same panel
 * must not swap because of a 2% height difference).
 */
export const ROW_TOLERANCE = 0.06;

export function readingOrder<T extends { x: number; y: number }>(captions: T[]): T[] {
  const byY = captions.slice().sort((a, b) => a.y - b.y);
  const ordered: T[] = [];
  let row: T[] = [];
  const flush = (): void => {
    row.sort((a, b) => a.x - b.x);
    ordered.push(...row);
    row = [];
  };
  for (const c of byY) {
    if (row.length && c.y - row[0].y > ROW_TOLERANCE) flush();
    row.push(c);
  }
  flush();
  return ordered;
}
