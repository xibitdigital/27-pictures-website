/**
 * Caption models for the standalone bubble gallery.
 * Same buildCaption path the reader and studio use.
 */
import { buildCaption, type CaptionContext, type CaptionModel } from "../../bookReader/captions/captionModel";
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
