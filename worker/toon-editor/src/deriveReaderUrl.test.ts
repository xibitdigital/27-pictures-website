import { describe, expect, it } from "vitest";
import { deriveReaderUrl } from "./index";

function dbWithSeries(hubUrl: string | null) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              return /FROM series/.test(sql) ? { hub_url: hubUrl } : null;
            },
          };
        },
      };
    },
  };
}

describe("deriveReaderUrl", () => {
  it("returns null when the toon has no series", async () => {
    expect(await deriveReaderUrl({ DB: dbWithSeries("/toons/erin-and-the-goblins/") }, null, "graph-test")).toBeNull();
  });

  it("returns null when the series has no hub_url yet", async () => {
    expect(await deriveReaderUrl({ DB: dbWithSeries(null) }, "erin", "graph-test")).toBeNull();
  });

  it("nests the slug under the series hub_url", async () => {
    expect(await deriveReaderUrl({ DB: dbWithSeries("/toons/erin-and-the-goblins/") }, "erin", "graph-test")).toBe(
      "/toons/erin-and-the-goblins/graph-test/"
    );
  });

  it("tolerates a hub_url missing its trailing slash", async () => {
    expect(await deriveReaderUrl({ DB: dbWithSeries("/toons/erin-and-the-goblins") }, "erin", "graph-test")).toBe(
      "/toons/erin-and-the-goblins/graph-test/"
    );
  });
});
