import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm", () => ({ default: {} }));
vi.mock("@jsquash/png/codec/pkg/squoosh_png_bg.wasm", () => ({ default: {} }));
vi.mock("@jsquash/webp/codec/enc/webp_enc_simd.wasm", () => ({ default: {} }));

const { decodedImage } = vi.hoisted(() => ({
  decodedImage: { width: 2, height: 2, data: new Uint8ClampedArray(16) },
}));

vi.mock("@jsquash/jpeg/decode", () => ({
  default: vi.fn().mockResolvedValue(decodedImage),
  init: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@jsquash/png/decode", () => ({
  default: vi.fn().mockResolvedValue(decodedImage),
  init: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@jsquash/webp/encode", () => ({
  default: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  init: vi.fn().mockResolvedValue(undefined),
}));

import encodeWebp from "@jsquash/webp/encode";
import { toWebp, webpDimensions } from "./imageOptimize";

function bytesFromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Real files from `magick -size WxH xc:white [-define webp:lossless=true] out.webp`,
// verified against `magick identify` before being embedded here.
const REAL_LOSSY_50X30 = "UklGRjQAAABXRUJQVlA4ICgAAAAQAwCdASoyAB4APpFIn0ulpCKhpAgAsBIJaQAAH2A8tGAA/vhNAAAA";
const REAL_LOSSLESS_60X40 = "UklGRiQAAABXRUJQVlA4TBcAAAAvO8AJAAfQ//73v/8BICH8Xy9G9D/1AQA=";

describe("toWebp", () => {
  afterEach(() => {
    vi.mocked(encodeWebp).mockClear();
    vi.mocked(encodeWebp).mockResolvedValue(new ArrayBuffer(8));
  });

  it("passes webp through unchanged", async () => {
    const image = { bytes: new ArrayBuffer(4), ext: "webp", type: "image/webp" };
    expect(await toWebp(image)).toBe(image);
    expect(encodeWebp).not.toHaveBeenCalled();
  });

  it("does not recompress webp even when the declared type is wrong", async () => {
    const header = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    const image = { bytes: header.buffer, ext: "png", type: "image/png" };
    const out = await toWebp(image);
    expect(out.bytes).toBe(image.bytes);
    expect(out.ext).toBe("webp");
    expect(out.type).toBe("image/webp");
    expect(encodeWebp).not.toHaveBeenCalled();
  });

  it("re-encodes png to webp", async () => {
    const out = await toWebp({ bytes: new ArrayBuffer(4), ext: "png", type: "image/png" });
    expect(out.ext).toBe("webp");
    expect(out.type).toBe("image/webp");
  });

  it("re-encodes jpg to webp", async () => {
    const out = await toWebp({ bytes: new ArrayBuffer(4), ext: "jpg", type: "image/jpeg" });
    expect(out.ext).toBe("webp");
  });

  it("passes unrecognised formats through unchanged", async () => {
    const image = { bytes: new ArrayBuffer(4), ext: "gif", type: "image/gif" };
    expect(await toWebp(image)).toBe(image);
  });

  it("falls back to the original bytes if encoding fails", async () => {
    vi.mocked(encodeWebp).mockRejectedValueOnce(new Error("boom"));
    const image = { bytes: new ArrayBuffer(4), ext: "png", type: "image/png" };
    expect(await toWebp(image)).toBe(image);
  });
});

describe("webpDimensions", () => {
  it("reads a lossy (VP8) file's real dimensions from its header", () => {
    expect(webpDimensions(bytesFromBase64(REAL_LOSSY_50X30))).toEqual({ width: 50, height: 30 });
  });

  it("reads a lossless (VP8L) file's real dimensions from its header", () => {
    expect(webpDimensions(bytesFromBase64(REAL_LOSSLESS_60X40))).toEqual({ width: 60, height: 40 });
  });

  it("is what would have caught the Flux size-mismatch bug: request says one size, file says another", () => {
    // Flux was asked for 385x443 (the region's own box) but returned a full 1152x1728
    // plate — the real bug this function exists to catch before it reaches D1.
    const requested = { width: 385, height: 443 };
    const actual = webpDimensions(bytesFromBase64(REAL_LOSSLESS_60X40));
    expect(actual).not.toEqual(requested);
    expect(actual).toEqual({ width: 60, height: 40 });
  });

  it("returns null for bytes that aren't a WebP file", () => {
    expect(webpDimensions(new ArrayBuffer(40))).toBeNull();
    expect(webpDimensions(new TextEncoder().encode("not a webp at all, just text").buffer)).toBeNull();
  });

  it("returns null for a truncated/corrupt WebP header rather than throwing", () => {
    const truncated = bytesFromBase64(REAL_LOSSY_50X30).slice(0, 10);
    expect(() => webpDimensions(truncated)).not.toThrow();
    expect(webpDimensions(truncated)).toBeNull();
  });
});
