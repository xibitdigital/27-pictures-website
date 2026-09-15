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
 * and re-fit the wrap/padding to match. These fixed scale factors around the
 * default organic body stand in for that drag so the fit can be eyeballed
 * without opening the plate studio.
 */
const RESHAPE_CASES: { key: string; label: string; scaleX: number; scaleY: number }[] = [
  { key: "default", label: "Default (no reshape)", scaleX: 1, scaleY: 1 },
  { key: "wide-tall", label: "Wide + tall (1.5x / 1.9x)", scaleX: 1.5, scaleY: 1.9 },
  { key: "narrow", label: "Narrow (0.7x / 1.3x)", scaleX: 0.7, scaleY: 1.3 },
  { key: "narrow-tall", label: "Narrow + tall, pinched (0.5x / 2.1x)", scaleX: 0.5, scaleY: 2.1 },
];

function reshapeCaption(scaleX: number, scaleY: number, index: number, text: string): CaptionModel | null {
  const line = text.trim() ? text : PLACEHOLDER_TEXT;
  const tail = "bottom-left";
  const seed = hashSeed(1, index, line, 0.5, 0.5, tail);
  const base = defaultBubblePoints("organic", tail, seed);
  if (!base) return null;
  const cx = 50;
  const cy = 50;
  const points: BubblePoint[] = base.map(([x, y]) => [cx + (x - cx) * scaleX, cy + (y - cy) * scaleY]);
  return buildCaption(
    { x: 0.5, y: 0.5, align: "center", variant: "bubble", tail, text: { en: line }, bubblePoints: points },
    index,
    CTX
  );
}

export function reshapeRows(text: string): { key: string; label: string; caption: CaptionModel }[] {
  return RESHAPE_CASES.flatMap((c, i) => {
    const caption = reshapeCaption(c.scaleX, c.scaleY, 1000 + i, text);
    return caption ? [{ key: c.key, label: c.label, caption }] : [];
  });
}
