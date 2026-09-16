import { describe, expect, it, vi, beforeEach } from "vitest";
import worker, { contentTypeFor, objectKey } from "./index";
import { buildXmpPacket, injectXmp } from "./webpXmp";

/** A minimal valid VP8L WebP — real enough for injectXmp to actually run, not just no-op. */
function makeSimpleWebp(width: number, height: number): Uint8Array {
  const bits = (width - 1) | ((height - 1) << 14);
  const vp8lData = new Uint8Array([0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, 0, 0, 0]);
  const chunkSize = vp8lData.length;
  const riffPayload = new Uint8Array(4 + 8 + chunkSize + (chunkSize % 2));
  riffPayload.set(new TextEncoder().encode("WEBP"), 0);
  riffPayload.set(new TextEncoder().encode("VP8L"), 4);
  new DataView(riffPayload.buffer).setUint32(8, chunkSize, true);
  riffPayload.set(vp8lData, 12);
  const out = new Uint8Array(8 + riffPayload.length);
  out.set(new TextEncoder().encode("RIFF"), 0);
  new DataView(out.buffer).setUint32(4, riffPayload.length, true);
  out.set(riffPayload, 8);
  return out;
}

describe("objectKey", () => {
  it("allows toons and card-art keys", () => {
    expect(objectKey("/toons/jax/assets/abc.webp")).toBe("toons/jax/assets/abc.webp");
    expect(objectKey("/card-art/erin.jpg")).toBe("card-art/erin.jpg");
  });

  it("rejects editor keys, traversal, and anything else", () => {
    expect(objectKey("/editor/foo.webp")).toBeNull();
    expect(objectKey("/toons/../editor/x")).toBeNull();
    expect(objectKey("/robots.txt")).toBeNull();
    expect(objectKey("/")).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it("maps extensions and prefers stored type", () => {
    expect(contentTypeFor("toons/a.webp")).toBe("image/webp");
    expect(contentTypeFor("toons/a.mp3")).toBe("audio/mpeg");
    expect(contentTypeFor("toons/a.webp", "image/png")).toBe("image/png");
  });
});

function envWith(get: (key: string) => Promise<R2ObjectBody | null>): { ASSETS: R2Bucket } {
  return { ASSETS: { get } as unknown as R2Bucket };
}

describe("assets worker", () => {
  const cacheStore = new Map<string, Response>();

  beforeEach(() => {
    cacheStore.clear();
    vi.stubGlobal("caches", {
      default: {
        match: async (req: Request) => cacheStore.get(new URL(req.url).pathname) ?? undefined,
        put: async (req: Request, res: Response) => {
          cacheStore.set(new URL(req.url).pathname, res);
        },
      },
    });
  });

  it("serves robots.txt", async () => {
    const res = await worker.fetch(
      new Request("https://assets.twentyseven.pictures/robots.txt"),
      envWith(async () => null),
      { waitUntil() {}, passThroughOnException() {}, props: {} }
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Disallow: /");
    expect(text).toContain("GPTBot");
  });

  it("404s unknown prefixes", async () => {
    const res = await worker.fetch(
      new Request("https://assets.twentyseven.pictures/secret.png"),
      envWith(async () => null),
      { waitUntil() {}, passThroughOnException() {}, props: {} }
    );
    expect(res.status).toBe(404);
  });

  it("returns the object with cache and noai headers", async () => {
    const body = new Uint8Array([1, 2, 3]);
    const res = await worker.fetch(
      new Request("https://assets.twentyseven.pictures/toons/jax/assets/a.webp"),
      envWith(async () => {
        return {
          body: body as unknown as ReadableStream,
          arrayBuffer: async () => body.buffer,
          size: 3,
          etag: '"abc"',
          httpEtag: '"abc"',
          httpMetadata: { contentType: "image/webp" },
        } as unknown as R2ObjectBody;
      }),
      { waitUntil() {}, passThroughOnException() {}, props: {} }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(res.headers.get("X-Robots-Tag")).toBe("noai, noimageai, noindex");
  });

  it("embeds an XMP rights packet into a real webp's bytes", async () => {
    const original = makeSimpleWebp(12, 9);
    const res = await worker.fetch(
      new Request("https://assets.twentyseven.pictures/toons/jax/assets/a.webp"),
      envWith(async () => {
        return {
          body: original as unknown as ReadableStream,
          arrayBuffer: async () => original.buffer,
          size: original.length,
          etag: '"abc"',
          httpEtag: '"abc"',
          httpMetadata: { contentType: "image/webp" },
        } as unknown as R2ObjectBody;
      }),
      { waitUntil() {}, passThroughOnException() {}, props: {} }
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBe(injectXmp(original, buildXmpPacket()).length);
    expect(Number(res.headers.get("Content-Length"))).toBe(bytes.length);
    expect(new TextDecoder().decode(bytes)).toContain("Not licensed for AI/ML training");
  });
});
