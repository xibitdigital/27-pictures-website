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

function isWebpBytes(bytes: ArrayBuffer): boolean {
  const u = new Uint8Array(bytes.slice(0, 12));
  return u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x45;
}

/**
 * Returns the plate re-encoded as WebP, or the original bytes unchanged if
 * it's already WebP, an unrecognised format, or encoding fails for any
 * reason — a heavier plate beats a broken generation.
 */
export async function toWebp(image: ImageBytes): Promise<ImageBytes> {
  if (image.ext === "webp" || image.type === "image/webp" || isWebpBytes(image.bytes)) {
    return image.ext === "webp" && image.type === "image/webp"
      ? image
      : { bytes: image.bytes, ext: "webp", type: "image/webp" };
  }
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

/**
 * Reads width/height straight from a WebP file's own header — no decode.
 * Every plate is WebP by the time it's about to be stored (either already,
 * or just re-encoded above), so this is the one check that catches an image
 * provider silently not honoring a requested size (seen with Flux: asked
 * for 385x443, got 1152x1728 back) before that wrong size gets written to
 * D1 and corrupts every region-composite math that trusts it. Returns null
 * for anything that isn't a well-formed WebP rather than throwing — a
 * missing dimension check should never be why a generation fails outright.
 */
export function webpDimensions(bytes: ArrayBuffer): { width: number; height: number } | null {
  const u = new Uint8Array(bytes);
  if (u.length < 30 || !isWebpBytes(bytes)) return null;
  const fourCC = String.fromCharCode(u[12], u[13], u[14], u[15]);
  if (fourCC === "VP8X") {
    const width = 1 + (u[24] | (u[25] << 8) | (u[26] << 16));
    const height = 1 + (u[27] | (u[28] << 8) | (u[29] << 16));
    return { width, height };
  }
  if (fourCC === "VP8L") {
    if (u[20] !== 0x2f) return null;
    const b0 = u[21];
    const b1 = u[22];
    const b2 = u[23];
    const b3 = u[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  if (fourCC === "VP8 ") {
    // Bitstream sync code 0x9D 0x01 0x2A marks the start of the frame header.
    if (u[23] !== 0x9d || u[24] !== 0x01 || u[25] !== 0x2a) return null;
    const width = (u[26] | (u[27] << 8)) & 0x3fff;
    const height = (u[28] | (u[29] << 8)) & 0x3fff;
    return { width, height };
  }
  return null;
}
