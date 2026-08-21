/**
 * FlipFrame speech / caption bubble chrome.
 *
 * SVG paths (viewBox 0–100) stretched over the text box:
 * - organic  — sketchy speech balloon + integrated tail
 * - thought  — scalloped cloud body + trailing bubble dots (no pointed tail)
 * - box/clean — AI HUD / torn-paper panels
 * - star     — impact / shout burst
 *
 * Used by the caption components (`variant: "bubble" | "thought" | "ai" | "badai" | "burst"`).
 */
// @ts-nocheck — matches words.ts imperative style

/** Deterministic 0–1 PRNG from numeric seed */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed from mixed parts (page index, word text, position, …). */
export function hashSeed(...parts: Array<string | number | null | undefined>): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type BubbleTail = "none" | "bottom" | "bottom-left" | "bottom-right" | "left" | "right";

export interface BubbleStyle {
  shape: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  tail: string;
  padX: number;
  padY: number;
  retrace: number;
  scratches: number;
  /** 0–1 fill opacity of the bubble body only (stroke stays opaque). */
  opacity: number;
}

/** Default outline thickness for organic speech balloons (SVG stroke-width). */
export const BUBBLE_STROKE_WIDTH = 5;

/**
 * House fill opacity for every balloon: lettering must never sit on flat white
 * over a plate. Every config in the repo carried `"opacity": 0.75` on every
 * single word to get this — it is the style, so it is the default, and a config
 * only says anything when it wants something else.
 */
export const BUBBLE_FILL_OPACITY = 0.75;

/**
 * Default chrome for organic speech balloons (`variant: "bubble"`).
 * Config may omit `bubble` entirely; only set overrides (e.g. tail) when needed.
 */
export const DEFAULT_ORGANIC_BUBBLE = {
  shape: "organic",
  fill: "#ffffff",
  stroke: "#111111",
  strokeWidth: BUBBLE_STROKE_WIDTH,
  tail: "bottom-left" as BubbleTail,
  padX: 1,
  padY: 1,
};

/**
 * Catmull–Rom spline through points → cubic Bézier SVG path commands.
 * Tension 1/6 ≈ centripetal CR converted to cubic (smooth organic outline).
 *
 * @param pts control points [[x,y], …]
 * @param closed wrap for a closed loop (adds Z)
 * @param startWithMove if false, only emit C segments (path already at pts[0])
 */
function cubicSplineThrough(pts: number[][], closed = false, startWithMove = true, tension = 1 / 6): string {
  const n = pts.length;
  if (n < 2) return "";

  const get = (i: number): number[] => {
    if (closed) return pts[((i % n) + n) % n];
    if (i < 0) return pts[0];
    if (i >= n) return pts[n - 1];
    return pts[i];
  };

  let d = startWithMove ? `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}` : "";
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) * tension;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(
      2
    )} ${p2[1].toFixed(2)}`;
  }
  if (closed) d += " Z";
  return d;
}

/**
 * Sketchy organic speech bubble in viewBox 0–100.
 * Catmull–Rom cubic spline outline: ellipse body + integrated triangular tail.
 */
export function sketchyBubblePath(tail: string, seed?: number): string {
  const rnd = mulberry32(seed || 1);
  const j = (amp: number) => (rnd() - 0.5) * 2 * amp;
  const t = tail || "bottom";

  const cx = 50;
  const cy = 50;
  const rx = 46;
  const ry = 44;
  // Sparse anchors — cubic spline fills the gaps with smooth curves
  const n = 8;

  function onEllipse(a: number) {
    return [cx + Math.cos(a) * (rx + j(1.2)), cy + Math.sin(a) * (ry + j(1.2))];
  }

  if (t === "none") {
    const pts: number[][] = [];
    for (let i = 0; i < n; i++) pts.push(onEllipse((i / n) * Math.PI * 2 - Math.PI / 2));
    return cubicSplineThrough(pts, true);
  }

  let attachA = Math.PI / 2;
  let tip = [50, 118];
  let halfW = 0.28;
  if (t === "bottom-left") {
    attachA = Math.PI / 2 + 0.4;
    tip = [28, 116];
  } else if (t === "bottom-right") {
    attachA = Math.PI / 2 - 0.4;
    tip = [72, 116];
  } else if (t === "left") {
    attachA = Math.PI;
    tip = [-16, 52];
    halfW = 0.26;
  } else if (t === "right") {
    attachA = 0;
    tip = [116, 52];
    halfW = 0.26;
  } else if (t === "top") {
    attachA = -Math.PI / 2;
    tip = [50, -18];
  } else if (t === "top-left") {
    attachA = -Math.PI / 2 - 0.4;
    tip = [28, -16];
  } else if (t === "top-right") {
    attachA = -Math.PI / 2 + 0.4;
    tip = [72, -16];
  }

  const a0 = attachA + halfW;
  const span = Math.PI * 2 - halfW * 2;
  const body: number[][] = [];
  for (let i = 0; i <= n; i++) {
    body.push(onEllipse(a0 + (i / n) * span));
  }

  const tipJ = [tip[0] + j(1.2), tip[1] + j(1.2)];
  const mouthL = body[body.length - 1];
  const mouthR = body[0];

  // Body: open cubic spline mouthR → … → mouthL
  let d = cubicSplineThrough(body, false, true);

  // Tail sides as cubic splines (3-point open CR: mouth → mid → tip / tip → mid → mouth)
  // Sharp tip: midpoints slightly offset so the lobe reads as a speech-bubble pointer.
  const midL = [mouthL[0] * 0.45 + tipJ[0] * 0.55 + j(1.5), mouthL[1] * 0.45 + tipJ[1] * 0.55 + j(1.5)];
  const midR = [mouthR[0] * 0.45 + tipJ[0] * 0.55 + j(1.5), mouthR[1] * 0.45 + tipJ[1] * 0.55 + j(1.5)];

  d += cubicSplineThrough([mouthL, midL, tipJ], false, false);
  d += cubicSplineThrough([tipJ, midR, mouthR], false, false);
  d += " Z";
  return d;
}

/** Tail tip coordinates shared by the pointed (sketchy) and dotted (thought) bubble tails. */
const BUBBLE_TAIL_TIPS: Record<string, [number, number]> = {
  bottom: [50, 118],
  "bottom-left": [28, 116],
  "bottom-right": [72, 116],
  left: [-16, 52],
  right: [116, 52],
  top: [50, -18],
  "top-left": [28, -16],
  "top-right": [72, -16],
};

/** Thought-body geometry — shared by the outline and the trailing-dot spacing. */
const THOUGHT_BODY = { cx: 50, cy: 50, rx: 46, ry: 44, anchors: 8 };
/** Per-anchor jitter of the body spline: the outline can bulge this far past rx/ry. */
const THOUGHT_WOBBLE = 1.2;
/** Clear air left between body↔dot and dot↔dot outlines (viewBox units). */
const THOUGHT_GAP = 3.5;

/**
 * Trailing "thinking" dots for a thought bubble, walking outward from the body
 * along the tail direction. Each dot starts where the previous outline ends
 * plus `THOUGHT_GAP`, so **nothing ever intersects the body or another dot** —
 * and because the caption box applies an affine (if non-uniform) stretch,
 * disjoint here stays disjoint on screen.
 *
 * Exported for tests; `thoughtBubblePath` is the render path.
 */
export function thoughtTailDots(tail: string, seed?: number): Array<{ x: number; y: number; r: number }> {
  const t = tail || "bottom";
  if (t === "none") return [];

  const rnd = mulberry32((seed || 1) + 733);
  const j = (amp: number) => (rnd() - 0.5) * 2 * amp;
  const { cx, cy, rx, ry } = THOUGHT_BODY;

  const tip = BUBBLE_TAIL_TIPS[t] || BUBBLE_TAIL_TIPS.bottom;
  const len = Math.hypot(tip[0] - cx, tip[1] - cy) || 1;
  const ux = (tip[0] - cx) / len;
  const uy = (tip[1] - cy) / len;
  // Jitter runs *across* the trail only. Perpendicular offset can never shorten
  // the centre distance between two dots, so the spacing solved below holds.
  const nx = -uy;
  const ny = ux;

  // Where the body outline sits along the trail: ray/ellipse hit, with rx/ry
  // padded by the spline wobble so the bulges between anchors are covered too.
  const edge = 1 / Math.hypot(ux / (rx + THOUGHT_WOBBLE), uy / (ry + THOUGHT_WOBBLE));

  const dots: Array<{ x: number; y: number; r: number }> = [];
  let reach = edge;
  for (const base of [7, 4.2]) {
    const r = Math.max(2, base + j(base * 0.12));
    const dist = reach + THOUGHT_GAP + r;
    const off = j(1.2);
    dots.push({ x: cx + ux * dist + nx * off, y: cy + uy * dist + ny * off, r });
    reach = dist + r;
  }
  return dots;
}

/**
 * Thought bubble in viewBox 0–100: a plain closed ellipse body — same
 * geometry as the tailless organic bubble, which is already proven safe
 * under the non-uniform `preserveAspectRatio="none"` stretch every caption
 * box applies — plus 2 shrinking trailing dots standing in for a pointed
 * tail, the classic "thinking" trail toward the speaker.
 *
 * A scalloped cloud outline was tried first and rejected: at a wide/short
 * caption aspect the lobes cross over each other (the spline self-
 * intersects), which reads as a jagged burst instead of a soft cloud.
 *
 * Dots are spaced off the body outline (see `thoughtTailDots`), never off a
 * fraction of the centre→tip vector — that older scheme dropped the first dot
 * *inside* the balloon on side tails, so the rim cut straight through it.
 */
export function thoughtBubblePath(tail: string, seed?: number): string {
  const rnd = mulberry32(seed || 1);
  const j = (amp: number) => (rnd() - 0.5) * 2 * amp;
  const { cx, cy, rx, ry, anchors } = THOUGHT_BODY;

  const pts: number[][] = [];
  for (let i = 0; i < anchors; i++) {
    const a = (i / anchors) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * (rx + j(THOUGHT_WOBBLE)), cy + Math.sin(a) * (ry + j(THOUGHT_WOBBLE))]);
  }
  let d = cubicSplineThrough(pts, true);

  for (const { x, y, r } of thoughtTailDots(tail, seed)) {
    const left = (x - r).toFixed(2);
    const right = (x + r).toFixed(2);
    const mid = y.toFixed(2);
    const rr = r.toFixed(2);
    d += ` M ${right} ${mid} A ${rr} ${rr} 0 1 0 ${left} ${mid} A ${rr} ${rr} 0 1 0 ${right} ${mid} Z`;
  }

  return d;
}

/**
 * Rough torn-paper rectangle path (viewBox 0-100 x 0-100) — no tail.
 * Used for "AI dialogue" caption boxes ("COMBAT MODE ACTIVATED" style).
 */
export function jaggedBoxPath(
  seed?: number,
  opts?: { amp?: number; corner?: number; segments?: number; bow?: number }
): string {
  const rnd = mulberry32(seed || 1);
  const j = (amp: number) => (rnd() - 0.5) * 2 * amp;
  const amp = opts && opts.amp != null ? opts.amp : 3.5;
  const corner = opts && opts.corner != null ? opts.corner : 3;
  const segments = opts && opts.segments != null ? opts.segments : 6;
  const bow = opts && opts.bow != null ? opts.bow : 1.4;

  function edge(x0: number, y0: number, x1: number, y1: number, edgeAmp: number, segs: number) {
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
export function cleanBoxPath(seed?: number): string {
  return jaggedBoxPath(seed, { amp: 0.9, corner: 0.8, segments: 4, bow: 0.35 });
}

/**
 * Jagged star-burst outline (viewBox 0-100 x 0-100) — no tail.
 * Shouted lines / impact captions ("TOO SLOW, MAN!" style).
 */
export function starBurstPath(seed?: number, points?: number): string {
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
 * Short overshooting scratch strokes from the box perimeter (sketchy AI panels).
 */
export function scribbleScratches(seed: number, count: number): string[] {
  const rnd = mulberry32(seed || 1);
  const bounds = { x0: 4, y0: 6, x1: 96, y1: 94 };
  const scratches = [];

  for (let i = 0; i < count; i++) {
    const edgeIdx = Math.floor(rnd() * 4);
    const t = 0.06 + rnd() * 0.88;
    let x: number, y: number, nx: number, ny: number;
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

export function boxPathForShape(shape: string, seed?: number): string {
  if (shape === "clean" || shape === "frame" || shape === "rect") return cleanBoxPath(seed);
  return jaggedBoxPath(seed);
}

/**
 * Resolve fill/stroke/tail/padding for a caption word + variant.
 * @param w WordEntry-like object
 * @param variant plain | bubble | ai | badai | burst | credit
 *
 * Polarity (small but readable):
 * - `ai`    — soft dark HUD (Nova / good system): fill = stroke, thin edge
 * - `badai` — inverted + harsher (hostile): light fill, dark thick stroke, more scratches
 */
export function resolveBubbleStyle(w: Record<string, unknown>, variant: string): BubbleStyle {
  const b = w.bubble && typeof w.bubble === "object" ? (w.bubble as Record<string, unknown>) : {};
  const isAi = variant === "ai";
  const isBadai = variant === "badai";
  const isHud = isAi || isBadai;
  const isBurst = variant === "burst";
  const isThought = variant === "thought";
  const shape = (
    (b.shape as string) ||
    (w.bubbleShape as string) ||
    (isHud ? "box" : isBurst ? "star" : isThought ? "thought" : DEFAULT_ORGANIC_BUBBLE.shape)
  )
    .toString()
    .toLowerCase();
  const isClean = shape === "clean" || shape === "frame" || shape === "rect";
  // Fill opacity only (0–1). Accept 0–1 or 0–100 (e.g. 80 → 0.8).
  let opacity = BUBBLE_FILL_OPACITY;
  const rawOp =
    b.opacity != null ? Number(b.opacity) : w.bubbleOpacity != null ? Number(w.bubbleOpacity) : BUBBLE_FILL_OPACITY;
  if (Number.isFinite(rawOp)) {
    opacity = rawOp > 1 ? Math.min(1, rawOp / 100) : Math.max(0, Math.min(1, rawOp));
  }
  return {
    shape,
    fill:
      (b.fill as string) ||
      (w.bubbleFill as string) ||
      (isBadai ? "#f5f5f5" : isAi ? "#0a0a0a" : isBurst ? "#ffffff" : DEFAULT_ORGANIC_BUBBLE.fill),
    stroke:
      (b.stroke as string) ||
      (w.bubbleStroke as string) ||
      // Nova: soft edge (stroke matches fill). Badai: hard dark outline.
      (isBadai ? "#0a0a0a" : isAi ? "#0a0a0a" : isBurst ? "#111111" : DEFAULT_ORGANIC_BUBBLE.stroke),
    strokeWidth:
      b.strokeWidth != null
        ? Number(b.strokeWidth)
        : b.strokeThickness != null
          ? Number(b.strokeThickness)
          : w.bubbleStrokeWidth != null
            ? Number(w.bubbleStrokeWidth)
            : isBadai
              ? 4.5
              : isAi
                ? 2.2
                : BUBBLE_STROKE_WIDTH,
    tail: (b.tail as string) || (w.tail as string) || (isHud || isBurst ? "none" : DEFAULT_ORGANIC_BUBBLE.tail),
    padX: b.padX != null ? Number(b.padX) : isHud ? 0.7 : isBurst ? 1.1 : DEFAULT_ORGANIC_BUBBLE.padX,
    padY: b.padY != null ? Number(b.padY) : isHud ? 0.5 : isBurst ? 0.9 : DEFAULT_ORGANIC_BUBBLE.padY,
    // Badai: extra retrace = harsher torn edge
    retrace: b.retrace != null ? Number(b.retrace) : isClean ? 0 : isBadai ? 3 : shape === "box" ? 2 : 0,
    // Badai: more perimeter scratches = corrupt HUD; Nova: slightly cleaner
    scratches:
      b.scratches != null ? Number(b.scratches) : isClean ? 0 : isBadai ? 16 : isAi ? 6 : shape === "box" ? 10 : 0,
    opacity,
  };
}

/**
 * Extra CSS class(es) a bubble variant needs beyond the base `jax-word--bubble`.
 * `badai` gets both `jax-word--ai` and `jax-word--badai` (shares AI HUD rules,
 * then overrides polarity). Leading space so callers can splice it straight
 * into a className string without a separate join step.
 */
export function resolveBubbleVariantClass(variant: string): string {
  switch (variant) {
    case "badai":
      return " jax-word--ai jax-word--badai";
    case "ai":
      return " jax-word--ai";
    case "burst":
      return " jax-word--burst";
    case "thought":
      return " jax-word--thought";
    default:
      return "";
  }
}
