import { describe, expect, it, vi, beforeEach } from "vitest";
import worker, { contentTypeFor, objectKey } from "./index";

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
});
