/**
 * Comfy hands back plates as PNG (occasionally JPEG). Re-encode to WebP q90
 * so a generated plate weighs the same as a hand-placed one (see CLAUDE.md's
 * "Plate colour" / swap-page WebP q90 pipeline). Cloudflare Workers can't do
 * dynamic wasm fetches, so each codec's wasm binary is imported statically
 * and handed to that codec's own init() — the pattern jSquash documents for
 * Workers (see examples/cloudflare-worker-esm-format in the jSquash repo).
 */
import decodeJpeg, { init as initJpegDecode } from "@jsquash/jpeg/decode";
import decodePng, { init as initPngDecode } from "@jsquash/png/decode";
import encodeWebp, { init as initWebpEncode } from "@jsquash/webp/encode";

import JPEG_DEC_WASM from "@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm";
import PNG_DEC_WASM from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
import WEBP_ENC_WASM from "@jsquash/webp/codec/enc/webp_enc_simd.wasm";

const WEBP_QUALITY = 90;

let jpegReady: Promise<unknown> | null = null;
let pngReady: Promise<unknown> | null = null;
let webpReady: Promise<unknown> | null = null;

export type ImageBytes = { bytes: ArrayBuffer; ext: string; type: string };

/**
 * Returns the plate re-encoded as WebP, or the original bytes unchanged if
 * it's already WebP, an unrecognised format, or encoding fails for any
 * reason — a heavier plate beats a broken generation.
 */
export async function toWebp(image: ImageBytes): Promise<ImageBytes> {
  if (image.ext === "webp") return image;
  if (image.ext !== "png" && image.ext !== "jpg" && image.ext !== "jpeg") return image;
  try {
    let imageData;
    if (image.ext === "png") {
      pngReady ??= initPngDecode(PNG_DEC_WASM);
      await pngReady;
      imageData = await decodePng(image.bytes);
    } else {
      jpegReady ??= Promise.resolve(initJpegDecode(JPEG_DEC_WASM));
      await jpegReady;
      imageData = await decodeJpeg(image.bytes);
    }
    webpReady ??= initWebpEncode(WEBP_ENC_WASM);
    await webpReady;
    const encoded = await encodeWebp(imageData, { quality: WEBP_QUALITY });
    return { bytes: encoded, ext: "webp", type: "image/webp" };
  } catch (err) {
    console.error("webp re-encode failed, keeping original plate", err);
    return image;
  }
}
