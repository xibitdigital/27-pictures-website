/**
 * Bubble chrome as data (paths + paint), so `BubbleChrome.vue` can render it
 * declaratively. The geometry itself still comes from `bubbles.ts`.
 */
import {
  BUBBLE_STROKE_WIDTH,
  boxPathForShape,
  scribbleScratches,
  sketchyBubblePath,
  starBurstPath,
  thoughtBubblePath,
  type BubbleStyle,
} from "../bubbles";

export interface BubblePathModel {
  d: string;
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
}

export interface BubbleChromeModel {
  paths: BubblePathModel[];
}

function bodyPath(style: BubbleStyle, seed: number, isBoxy: boolean): string {
  if (isBoxy) return boxPathForShape(style.shape, seed);
  if (style.shape === "star") return starBurstPath(seed);
  if (style.shape === "thought") return thoughtBubblePath(style.tail, seed);
  return sketchyBubblePath(style.tail, seed);
}

/**
 * Body path plus (for boxy HUD panels) retraced edges and perimeter scratches.
 * `strokeWidth` in config is design-space weight, converted with `designScale`
 * exactly like caption size — never mapped 1:1 to CSS px.
 */
export function buildBubbleChrome(seed: number, style: BubbleStyle, designScale: number): BubbleChromeModel {
  const isBoxy = style.shape === "box" || style.shape === "clean" || style.shape === "frame" || style.shape === "rect";

  const configured =
    style.strokeWidth != null && Number.isFinite(Number(style.strokeWidth))
      ? Math.max(0.5, Number(style.strokeWidth))
      : BUBBLE_STROKE_WIDTH;
  const scale = Number.isFinite(designScale) && designScale > 0 ? designScale : 1;
  const sw = Math.max(1, configured * scale);

  const fillOpacity =
    style.opacity != null && Number.isFinite(style.opacity) ? Math.max(0, Math.min(1, style.opacity)) : 1;

  const paths: BubblePathModel[] = [
    {
      d: bodyPath(style, seed, isBoxy),
      fill: style.fill,
      fillOpacity,
      stroke: style.stroke,
      strokeWidth: sw,
    },
  ];

  if (isBoxy) {
    const retraceN = Math.max(0, Math.min(3, style.retrace | 0));
    for (let i = 0; i < retraceN; i++) {
      paths.push({
        d: boxPathForShape(style.shape, (seed || 1) + 97 + i * 114),
        fill: "none",
        fillOpacity: 1,
        stroke: style.stroke,
        strokeWidth: Math.max(0.8, sw * (0.65 - i * 0.15)),
      });
    }

    const scratchN = Math.max(0, Math.min(16, style.scratches | 0));
    if (scratchN > 0) {
      scribbleScratches((seed || 1) + 401, scratchN).forEach((d, i) => {
        paths.push({
          d,
          fill: "none",
          fillOpacity: 1,
          stroke: style.stroke,
          strokeWidth: Math.max(0.9, sw * (0.4 + (i % 3) * 0.18)),
        });
      });
    }
  }

  return { paths };
}
