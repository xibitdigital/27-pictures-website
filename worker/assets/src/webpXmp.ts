/**
 * Injects an XMP metadata chunk into a WebP file's RIFF container — no
 * re-encode, just a container rewrite. Runs in the Workers runtime (no
 * native binaries, no child_process), so this is a small hand-rolled RIFF
 * muxer rather than a wrapper around exiftool/libwebp.
 *
 * WebP container: https://developers.google.com/speed/webp/docs/riff_container
 */

const VP8X_FLAG_XMP = 0x04;

interface RiffChunk {
  fourcc: string;
  data: Uint8Array;
}

function readFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function parseChunks(bytes: Uint8Array): RiffChunk[] {
  const chunks: RiffChunk[] = [];
  let offset = 12; // past "RIFF" + size(4) + "WEBP"
  while (offset + 8 <= bytes.length) {
    const fourcc = readFourCC(bytes, offset);
    const size = readUint32LE(bytes, offset + 4);
    const dataStart = offset + 8;
    const data = bytes.slice(dataStart, dataStart + size);
    chunks.push({ fourcc, data });
    offset = dataStart + size + (size % 2); // chunks are padded to an even length
  }
  return chunks;
}

/** VP8 (lossy) bitstream header: 3-byte tag, 3-byte start code, then two 16-bit (14-bit + 2-bit scale) dims. */
function readVp8Dims(data: Uint8Array): { width: number; height: number } | null {
  if (data.length < 10) return null;
  if (data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) return null;
  const width = (data[6] | (data[7] << 8)) & 0x3fff;
  const height = (data[8] | (data[9] << 8)) & 0x3fff;
  return { width, height };
}

/** VP8L (lossless) header: 1 signature byte (0x2f) then a 32-bit LE field packing 14-bit width-1 + 14-bit height-1. */
function readVp8lDims(data: Uint8Array): { width: number; height: number } | null {
  if (data.length < 5 || data[0] !== 0x2f) return null;
  const bits = data[1] | (data[2] << 8) | (data[3] << 16) | (data[4] << 24);
  const width = (bits & 0x3fff) + 1;
  const height = ((bits >> 14) & 0x3fff) + 1;
  return { width, height };
}

function canvasSize(chunks: RiffChunk[]): { width: number; height: number } | null {
  const vp8x = chunks.find((c) => c.fourcc === "VP8X");
  if (vp8x && vp8x.data.length >= 10) {
    const width = (vp8x.data[4] | (vp8x.data[5] << 8) | (vp8x.data[6] << 16)) + 1;
    const height = (vp8x.data[7] | (vp8x.data[8] << 8) | (vp8x.data[9] << 16)) + 1;
    return { width, height };
  }
  const vp8 = chunks.find((c) => c.fourcc === "VP8 ");
  if (vp8) {
    const dims = readVp8Dims(vp8.data);
    if (dims) return dims;
  }
  const vp8l = chunks.find((c) => c.fourcc === "VP8L");
  if (vp8l) {
    const dims = readVp8lDims(vp8l.data);
    if (dims) return dims;
  }
  return null;
}

function buildVp8xChunk(width: number, height: number, flags: number): RiffChunk {
  const data = new Uint8Array(10);
  data[0] = flags;
  const w = width - 1;
  const h = height - 1;
  data[4] = w & 0xff;
  data[5] = (w >> 8) & 0xff;
  data[6] = (w >> 16) & 0xff;
  data[7] = h & 0xff;
  data[8] = (h >> 8) & 0xff;
  data[9] = (h >> 16) & 0xff;
  return { fourcc: "VP8X", data };
}

function encodeChunk(chunk: RiffChunk): Uint8Array {
  const size = chunk.data.length;
  const padded = size % 2 === 1 ? size + 1 : size;
  const out = new Uint8Array(8 + padded);
  out.set(new TextEncoder().encode(chunk.fourcc), 0);
  out[4] = size & 0xff;
  out[5] = (size >> 8) & 0xff;
  out[6] = (size >> 16) & 0xff;
  out[7] = (size >> 24) & 0xff;
  out.set(chunk.data, 8);
  return out;
}

/**
 * Returns a new WebP file with `xmpXml` embedded as its XMP chunk, or the
 * original bytes unchanged if the container can't be parsed (malformed
 * input, or an unrecognized codec chunk — never worth failing the request
 * over a metadata add-on).
 */
export function injectXmp(bytes: Uint8Array, xmpXml: string): Uint8Array {
  if (bytes.length < 12 || readFourCC(bytes, 0) !== "RIFF" || readFourCC(bytes, 8) !== "WEBP") return bytes;

  const chunks = parseChunks(bytes);
  const size = canvasSize(chunks);
  if (!size) return bytes;

  const existingVp8x = chunks.find((c) => c.fourcc === "VP8X");
  const baseFlags = existingVp8x ? existingVp8x.data[0] : 0;
  const vp8x = buildVp8xChunk(size.width, size.height, baseFlags | VP8X_FLAG_XMP);

  const xmpChunk: RiffChunk = { fourcc: "XMP ", data: new TextEncoder().encode(xmpXml) };

  const rest = chunks.filter((c) => c.fourcc !== "VP8X" && c.fourcc !== "XMP ");
  const outChunks = [vp8x, ...rest, xmpChunk];

  const encoded = outChunks.map(encodeChunk);
  const totalSize = 4 + encoded.reduce((sum, c) => sum + c.length, 0); // 4 = "WEBP"

  const out = new Uint8Array(8 + totalSize);
  out.set(new TextEncoder().encode("RIFF"), 0);
  out[4] = totalSize & 0xff;
  out[5] = (totalSize >> 8) & 0xff;
  out[6] = (totalSize >> 16) & 0xff;
  out[7] = (totalSize >> 24) & 0xff;
  out.set(new TextEncoder().encode("WEBP"), 8);
  let offset = 12;
  for (const chunk of encoded) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Rights/opt-out packet baked into every served plate — a paper trail that survives a re-host,
 * same intent as the HTTP `X-Robots-Tag: noai` header but readable straight from the file. */
export function buildXmpPacket(): string {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
   <dc:rights>© 27 Pictures — twentyseven.pictures. Not licensed for AI/ML training.</dc:rights>
   <xmpRights:Marked>True</xmpRights:Marked>
   <xmpRights:UsageTerms>No AI training use permitted.</xmpRights:UsageTerms>
   <xmpRights:WebStatement>https://twentyseven.pictures</xmpRights:WebStatement>
   <photoshop:Credit>twentyseven.pictures</photoshop:Credit>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}
