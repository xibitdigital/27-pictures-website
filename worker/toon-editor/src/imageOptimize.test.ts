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
import { toWebp } from "./imageOptimize";

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
