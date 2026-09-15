/**
 * Caption models for the standalone bubble gallery.
 * Same buildCaption path the reader and studio use.
 */
import { buildCaption, type CaptionContext, type CaptionModel } from "../../bookReader/captions/captionModel";
import { defaultBubblePoints, hashSeed, type BubblePoint } from "../../bookReader/bubbles";
import { BUBBLE_TAILS, BUBBLE_VARIANTS, PLACEHOLDER_TEXT } from "../mapConfig";

const CTX: CaptionContext = {
  lang: "en",
  pageNum: 1,
  designWidth: 400,
  designHeight: 400,
  designScale: 1,
  fontFamily: '"Bangers", cursive',
};

export function galleryCaption(variant: string, tail: string, index: number, text: string): CaptionModel | null {
  const line = text.trim() ? text : PLACEHOLDER_TEXT;
  return buildCaption(
    {
      x: 0.5,
      y: 0.5,
      align: "center",
      variant,
      tail,
      text: { en: line },
    },
    index,
    CTX
  );
}

export function galleryRows(text: string): { variant: string; cells: { tail: string; caption: CaptionModel }[] }[] {
  let index = 0;
  return BUBBLE_VARIANTS.map((variant) => ({
    variant,
    cells: BUBBLE_TAILS.flatMap((tail) => {
      const caption = galleryCaption(variant, tail, index, text);
      index += 1;
      return caption ? [{ tail, caption }] : [];
    }),
  }));
}

/**
 * Editor reshape drags a balloon's control points away from the default
 * outline; `shapeTextFit` (captionModel.ts) then has to grow the lettering
 * and re-fit the wrap/padding to match. Uniform scales plus one lopsided
 * drag stand in for that so the fit can be eyeballed without the plate studio.
 */
type ReshapeCase = {
  key: string;
  label: string;
  transform: (pts: BubblePoint[]) => BubblePoint[];
};

function scaleAbout(scaleX: number, scaleY: number): (pts: BubblePoint[]) => BubblePoint[] {
  return (pts) => pts.map(([x, y]) => [50 + (x - 50) * scaleX, 50 + (y - 50) * scaleY]);
}

/** Pull the right and bottom-right handles out — a real reshape, not a uniform scale. */
function lopsidedPear(pts: BubblePoint[]): BubblePoint[] {
  return pts.map(([x, y]) => {
    const dx = x - 50;
    const dy = y - 50;
    const right = Math.max(0, dx / 46);
    const down = Math.max(0, dy / 44);
    return [50 + dx * (1 + 1.1 * right), 50 + dy * (1.15 + 0.95 * down)];
  });
}

const RESHAPE_CASES: ReshapeCase[] = [
  { key: "default", label: "Default (no reshape)", transform: scaleAbout(1, 1) },
  { key: "wide-tall", label: "Wide + tall (1.5x / 1.9x)", transform: scaleAbout(1.5, 1.9) },
  { key: "narrow", label: "Narrow (0.7x / 1.3x)", transform: scaleAbout(0.7, 1.3) },
  { key: "narrow-tall", label: "Narrow + tall, pinched (0.5x / 2.1x)", transform: scaleAbout(0.5, 2.1) },
  { key: "wide-short", label: "Wide + short (2.2x / 0.7x)", transform: scaleAbout(2.2, 0.7) },
  { key: "lopsided", label: "Lopsided pear (right + bottom handles dragged)", transform: lopsidedPear },
];

function reshapeCaption(
  transform: (pts: BubblePoint[]) => BubblePoint[],
  index: number,
  text: string
): CaptionModel | null {
  const line = text.trim() ? text : PLACEHOLDER_TEXT;
  const tail = "bottom-left";
  const seed = hashSeed(1, index, line, 0.5, 0.5, tail);
  const base = defaultBubblePoints("organic", tail, seed);
  if (!base) return null;
  const points = transform(base);
  return buildCaption(
    { x: 0.5, y: 0.5, align: "center", variant: "bubble", tail, text: { en: line }, bubblePoints: points },
    index,
    CTX
  );
}

export function reshapeRows(text: string): { key: string; label: string; caption: CaptionModel }[] {
  return RESHAPE_CASES.flatMap((c, i) => {
    const caption = reshapeCaption(c.transform, 1000 + i, text);
    return caption ? [{ key: c.key, label: c.label, caption }] : [];
  });
}
