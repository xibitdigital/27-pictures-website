import { describe, expect, it } from "vitest";
import { buildXmpPacket, injectXmp } from "./webpXmp";

function u32le(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

function chunk(fourcc: string, data: number[]): number[] {
  const bytes = Array.from(fourcc).map((c) => c.charCodeAt(0));
  const padded = data.length % 2 === 1 ? [...data, 0] : data;
  return [...bytes, ...u32le(data.length), ...padded];
}

/** A minimal (unpadded pixel data — never decoded, only the header is read) VP8L WebP. */
function makeSimpleWebp(width: number, height: number): Uint8Array {
  const bits = (width - 1) | ((height - 1) << 14);
  const vp8lData = [0x2f, ...u32le(bits).slice(0, 3), 0, 0, 0]; // signature + packed dims + padding
  const chunks = chunk("VP8L", vp8lData);
  const riffPayload = [...Array.from("WEBP").map((c) => c.charCodeAt(0)), ...chunks];
  const bytes = [...Array.from("RIFF").map((c) => c.charCodeAt(0)), ...u32le(riffPayload.length), ...riffPayload];
  return new Uint8Array(bytes);
}

function findChunk(bytes: Uint8Array, fourcc: string): Uint8Array | null {
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const cc = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    const data = bytes.slice(offset + 8, offset + 8 + size);
    if (cc === fourcc) return data;
    offset += 8 + size + (size % 2);
  }
  return null;
}

describe("injectXmp", () => {
  it("adds a VP8X chunk with the XMP flag set and preserves canvas size", () => {
    const original = makeSimpleWebp(37, 21);
    const xmp = buildXmpPacket();
    const out = injectXmp(original, xmp);

    const vp8x = findChunk(out, "VP8X");
    expect(vp8x).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(vp8x![0] & 0x04).toBe(0x04); // XMP flag bit

    const width = (vp8x![4] | (vp8x![5] << 8) | (vp8x![6] << 16)) + 1;
    const height = (vp8x![7] | (vp8x![8] << 8) | (vp8x![9] << 16)) + 1;
    expect(width).toBe(37);
    expect(height).toBe(21);
  });

  it("embeds the exact XMP packet bytes, round-trippable", () => {
    const xmp = buildXmpPacket();
    const out = injectXmp(makeSimpleWebp(10, 10), xmp);
    const xmpChunk = findChunk(out, "XMP ");
    expect(xmpChunk).not.toBeNull();
    expect(new TextDecoder().decode(xmpChunk!)).toBe(xmp);
  });

  it("keeps the original VP8L pixel chunk intact", () => {
    const original = makeSimpleWebp(8, 6);
    const originalVp8l = findChunk(original, "VP8L");
    const out = injectXmp(original, buildXmpPacket());
    const outVp8l = findChunk(out, "VP8L");
    expect(outVp8l).toEqual(originalVp8l);
  });

  it("re-running keeps a single XMP chunk (replaces, not appends)", () => {
    const original = makeSimpleWebp(5, 5);
    const once = injectXmp(original, buildXmpPacket());
    const twice = injectXmp(once, "<x:xmpmeta>second</x:xmpmeta>");
    let offset = 12;
    let count = 0;
    while (offset + 8 <= twice.length) {
      const cc = String.fromCharCode(twice[offset], twice[offset + 1], twice[offset + 2], twice[offset + 3]);
      const size = twice[offset + 4] | (twice[offset + 5] << 8) | (twice[offset + 6] << 16) | (twice[offset + 7] << 24);
      if (cc === "XMP ") count += 1;
      offset += 8 + size + (size % 2);
    }
    expect(count).toBe(1);
  });

  it("returns the input unchanged when the container can't be parsed", () => {
    const garbage = new Uint8Array([1, 2, 3, 4]);
    expect(injectXmp(garbage, buildXmpPacket())).toBe(garbage);
  });
});
