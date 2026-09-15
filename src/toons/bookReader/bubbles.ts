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

/** One spline / polygon vertex in the 0–100 bubble viewBox. */
export type BubblePoint = [number, number];

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
  /**
   * Optional authored outline. Organic / thought / star balloons generated
   * from seed when omitted; the editor writes these when a control point moves.
   */
  points?: BubblePoint[];
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

/** True when this chrome is a spline/star the studio can reshape with handles. */
export function isReshapableBubbleShape(shape: string): boolean {
  return shape === "organic" || shape === "thought" || shape === "star";
}

/**
 * Config / extraJson `bubblePoints` → viewBox vertices, or null if missing/invalid.
 * Needs at least 3 finite [x, y] pairs.
 */
export function parseBubblePoints(raw: unknown): BubblePoint[] | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const pts: BubblePoint[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) return null;
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    pts.push([x, y]);
  }
  return pts;
}

export function roundBubblePoints(pts: BubblePoint[]): BubblePoint[] {
  return pts.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
}

/**
 * Superellipse exponent. n=2 is an oval; n=4 is a squircle — flat sides,
 * round corners — which is what speech / thought balloons should read as.
 */
const SQUIRCLE_N = 4;
/** Half the tail mouth, in viewBox units — a pointer, not a second lobe. */
const TAIL_MOUTH = 3.6;
const BODY_CX = 50;
const BODY_CY = 50;
const BODY_RX = 46;
const BODY_RY = 44;
const BODY_ANCHORS = 8;

function squirclePoint(a: number, rx: number, ry: number, jx = 0, jy = 0): BubblePoint {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const e = 2 / SQUIRCLE_N;
  return [
    BODY_CX + Math.sign(c) * rx * Math.pow(Math.abs(c), e) + jx,
    BODY_CY + Math.sign(s) * ry * Math.pow(Math.abs(s), e) + jy,
  ];
}

/** Distance from the body centre to the squircle outline along unit (ux, uy). */
export function squircleEdge(ux: number, uy: number, rx: number, ry: number): number {
  const n = SQUIRCLE_N;
  const a = Math.pow(Math.abs(ux / rx), n) + Math.pow(Math.abs(uy / ry), n);
  if (a <= 0) return Math.min(rx, ry);
  return Math.pow(a, -1 / n);
}

/** Length past the rim along a 45° diagonal — similar reach to the axis tails. */
const CORNER_TAIL_LEN = 38;
const INV_SQRT2 = 1 / Math.sqrt(2);

const CORNER_TAILS: Record<string, { attachA: number; dir: [number, number] }> = {
  "bottom-left": { attachA: (3 * Math.PI) / 4, dir: [-1, 1] },
  "bottom-right": { attachA: Math.PI / 4, dir: [1, 1] },
  "top-left": { attachA: (-3 * Math.PI) / 4, dir: [-1, -1] },
  "top-right": { attachA: -Math.PI / 4, dir: [1, -1] },
};

function cornerTailTip(attachA: number, dir: [number, number]): [number, number] {
  const p = squirclePoint(attachA, BODY_RX, BODY_RY);
  return [p[0] + dir[0] * INV_SQRT2 * CORNER_TAIL_LEN, p[1] + dir[1] * INV_SQRT2 * CORNER_TAIL_LEN];
}

/** Parameter step from `attachA` whose chord on the squircle is `halfWidth`. */
function mouthAngle(attachA: number, rx: number, ry: number, halfWidth: number): number {
  const origin = squirclePoint(attachA, rx, ry);
  let lo = 0.002;
  let hi = 0.55;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const p = squirclePoint(attachA + mid, rx, ry);
    const d = Math.hypot(p[0] - origin[0], p[1] - origin[1]);
    if (d < halfWidth) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Seeded organic control points in viewBox 0–100. Tailless: 8 body anchors.
 * Tailed: body anchors + one tip (triangle: two mouth points, one tip).
 */
export function organicBubblePoints(tail: string, seed?: number): BubblePoint[] {
  const rnd = mulberry32(seed || 1);
  const j = (amp: number) => (rnd() - 0.5) * 2 * amp;
  const t = tail || "bottom";
  const rx = BODY_RX;
  const ry = BODY_RY;
  const n = BODY_ANCHORS;

  function onBody(a: number): BubblePoint {
    return squirclePoint(a, rx + j(0.6), ry + j(0.6), j(0.8), j(0.8));
  }

  if (t === "none") {
    const pts: BubblePoint[] = [];
    for (let i = 0; i < n; i++) pts.push(onBody((i / n) * Math.PI * 2 - Math.PI / 2));
    return pts;
  }

  let attachA = Math.PI / 2;
  let tip: [number, number] = [50, 118];
  const corner = CORNER_TAILS[t];
  if (corner) {
    attachA = corner.attachA;
    tip = cornerTailTip(corner.attachA, corner.dir);
  } else if (t === "left") {
    attachA = Math.PI;
    tip = [-16, 52];
  } else if (t === "right") {
    attachA = 0;
    tip = [116, 52];
  } else if (t === "top") {
    attachA = -Math.PI / 2;
    tip = [50, -18];
  }

  const halfW = mouthAngle(attachA, rx, ry, TAIL_MOUTH);
  const a0 = attachA + halfW;
  const span = Math.PI * 2 - halfW * 2;
  const body: BubblePoint[] = [];
  for (let i = 0; i <= n; i++) {
    body.push(onBody(a0 + (i / n) * span));
  }

  const tipJ: BubblePoint = [tip[0] + j(1.2), tip[1] + j(1.2)];
  return [...body, tipJ];
}

/**
 * Split authored/seeded points into body + tip. New tails store one tip after
 * the body. Staging reshape briefly stored midL/tip/midR — if the middle of
 * the last three is farthest from the centre, treat that as the tip.
 */
export function organicTailSplit(pts: BubblePoint[]): { body: BubblePoint[]; tip: BubblePoint } {
  if (pts.length >= 6) {
    const midL = pts[pts.length - 3];
    const maybeTip = pts[pts.length - 2];
    const midR = pts[pts.length - 1];
    const dist = (p: BubblePoint) => Math.hypot(p[0] - BODY_CX, p[1] - BODY_CY);
    if (dist(maybeTip) > dist(midL) && dist(maybeTip) > dist(midR)) {
      return { body: pts.slice(0, -3), tip: maybeTip };
    }
  }
  return { body: pts.slice(0, -1), tip: pts[pts.length - 1] };
}

/** Rebuild the organic outline from authored (or seeded) control points. */
export function organicBubblePathFromPoints(pts: BubblePoint[], tail: string): string {
  const t = tail || "bottom";
  if (t === "none" || pts.length < 4) return cubicSplineThrough(pts, true);
  const { body, tip } = organicTailSplit(pts);
  if (body.length < 3) return cubicSplineThrough(pts, true);
  const mouthR = body[0];
  let d = cubicSplineThrough(body, false, true);
  d += ` L ${tip[0].toFixed(2)} ${tip[1].toFixed(2)} L ${mouthR[0].toFixed(2)} ${mouthR[1].toFixed(2)} Z`;
  return d;
}

/**
 * Sketchy organic speech bubble in viewBox 0–100.
 * Catmull–Rom cubic spline outline: squircle body + a thin triangular tail.
 */
export function sketchyBubblePath(tail: string, seed?: number, controlPoints?: BubblePoint[] | null): string {
  const pts = controlPoints && controlPoints.length >= 3 ? controlPoints : organicBubblePoints(tail, seed);
  return organicBubblePathFromPoints(pts, tail);
}

/** Tail tip coordinates shared by the pointed (sketchy) and dotted (thought) bubble tails. */
const BUBBLE_TAIL_TIPS: Record<string, [number, number]> = {
  bottom: [50, 118],
  "bottom-left": cornerTailTip(CORNER_TAILS["bottom-left"].attachA, CORNER_TAILS["bottom-left"].dir),
  "bottom-right": cornerTailTip(CORNER_TAILS["bottom-right"].attachA, CORNER_TAILS["bottom-right"].dir),
  left: [-16, 52],
  right: [116, 52],
  top: [50, -18],
  "top-left": cornerTailTip(CORNER_TAILS["top-left"].attachA, CORNER_TAILS["top-left"].dir),
  "top-right": cornerTailTip(CORNER_TAILS["top-right"].attachA, CORNER_TAILS["top-right"].dir),
};

/** Thought-body geometry — shared by the outline and the trailing-dot spacing. */
const THOUGHT_BODY = { cx: BODY_CX, cy: BODY_CY, rx: BODY_RX, ry: BODY_RY, anchors: BODY_ANCHORS };
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

  // Where the body outline sits along the trail: ray/squircle hit, with rx/ry
  // padded by the spline wobble so the bulges between anchors are covered too.
  const edge = squircleEdge(ux, uy, rx + THOUGHT_WOBBLE, ry + THOUGHT_WOBBLE);

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
 * Thought bubble in viewBox 0–100: the same squircle body as a tailless
 * speech balloon (rounded-rect, safe under `preserveAspectRatio="none"`)
 * plus 2 shrinking trailing dots standing in for a pointed tail, the
 * classic "thinking" trail toward the speaker.
 *
 * A scalloped cloud outline was tried first and rejected: at a wide/short
 * caption aspect the lobes cross over each other (the spline self-
 * intersects), which reads as a jagged burst instead of a soft cloud.
 *
 * Dots are spaced off the body outline (see `thoughtTailDots`), never off a
 * fraction of the centre→tip vector — that older scheme dropped the first dot
 * *inside* the balloon on side tails, so the rim cut straight through it.
 */
export function thoughtBubblePoints(_tail: string, seed?: number): BubblePoint[] {
  const rnd = mulberry32(seed || 1);
  const j = (amp: number) => (rnd() - 0.5) * 2 * amp;
  const { rx, ry, anchors } = THOUGHT_BODY;
  const pts: BubblePoint[] = [];
  for (let i = 0; i < anchors; i++) {
    const a = (i / anchors) * Math.PI * 2 - Math.PI / 2;
    pts.push(squirclePoint(a, rx + j(0.6), ry + j(0.6), j(0.8), j(0.8)));
  }
  return pts;
}

export function thoughtBubblePath(tail: string, seed?: number, controlPoints?: BubblePoint[] | null): string {
  const pts = controlPoints && controlPoints.length >= 3 ? controlPoints : thoughtBubblePoints(tail, seed);
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
export function starBurstPoints(seed?: number, pointCount?: number): BubblePoint[] {
  const rnd = mulberry32(seed || 1);
  const n = pointCount || 13;
  const total = n * 2;
  const cx = 50;
  const cy = 50;
  const outerR = 48;
  const innerR = 27;

  const pts: BubblePoint[] = [];
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const baseR = i % 2 === 0 ? outerR : innerR;
    const r = baseR + rnd() * (baseR * 0.12);
    const a = angle + (rnd() - 0.5) * 2 * ((Math.PI / total) * 0.4);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function starBurstPathFromPoints(pts: BubblePoint[]): string {
  if (pts.length < 3) return "";
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;
  }
  d += " Z";
  return d;
}

export function starBurstPath(seed?: number, points?: number, controlPoints?: BubblePoint[] | null): string {
  const pts = controlPoints && controlPoints.length >= 3 ? controlPoints : starBurstPoints(seed, points);
  return starBurstPathFromPoints(pts);
}

/** Seeded handles for a reshapable chrome shape, or null for HUD/box variants. */
export function defaultBubblePoints(shape: string, tail: string, seed: number): BubblePoint[] | null {
  if (shape === "thought") return thoughtBubblePoints(tail, seed);
  if (shape === "star") return starBurstPoints(seed);
  if (shape === "organic") return organicBubblePoints(tail, seed);
  return null;
}

/** Organic / thought ellipse before jitter (2 × rx, 2 × ry) in viewBox units. */
export const DEFAULT_BODY_SIZE = { w: 92, h: 88 };

/**
 * Vertices that form the balloon body. Organic tails store a single tip after
 * the body; that must not drive wrap/padding or the lobe pulls the box.
 */
export function bubbleBodyPoints(shape: string, tail: string, points: BubblePoint[]): BubblePoint[] {
  if (shape === "organic" && tail !== "none" && points.length >= 4) return organicTailSplit(points).body;
  return points;
}

export function pointsBBox(pts: BubblePoint[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  if (!Number.isFinite(minX)) return { x: 8, y: 6, w: DEFAULT_BODY_SIZE.w, h: DEFAULT_BODY_SIZE.h };
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
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
    points: parseBubblePoints(b.points) || parseBubblePoints(w.bubblePoints) || undefined,
  };
}

/**
 * Extra CSS class(es) a bubble variant needs beyond the base `toon-word--bubble`.
 * `badai` gets both `toon-word--ai` and `toon-word--badai` (shares AI HUD rules,
 * then overrides polarity). Leading space so callers can splice it straight
 * into a className string without a separate join step.
 */
export function resolveBubbleVariantClass(variant: string): string {
  switch (variant) {
    case "badai":
      return " toon-word--ai toon-word--badai";
    case "ai":
      return " toon-word--ai";
    case "burst":
      return " toon-word--burst";
    case "thought":
      return " toon-word--thought";
    default:
      return "";
  }
}
