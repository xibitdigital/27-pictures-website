import { describe, expect, it } from "vitest";
import { mergeReplacedPage } from "./pageFile";
import type { PageRecord, ToonRecord } from "./types";

function page(partial: Partial<PageRecord> & Pick<PageRecord, "id">): PageRecord {
  return {
    position: 0,
    fileKey: "old.webp",
    fileUrl: "https://cdn.example/old.webp",
    width: 800,
    height: 1424,
    bubbles: [
      {
        id: "b1",
        x: 0.2,
        y: 0.1,
        variant: "bubble",
        tail: "bottom-left",
        size: 22,
        angle: null,
        textEn: "unsaved",
        sort: 0,
      },
    ],
    ...partial,
  };
}

function toon(pages: PageRecord[]): ToonRecord {
  return {
    id: "t1",
    slug: "demo",
    title: "Demo",
    subtitle: "",
    description: "",
    coverKey: null,
    coverUrl: null,
    designWidth: 800,
    designHeight: 1424,
    pages,
  };
}

describe("mergeReplacedPage", () => {
  it("swaps the plate and keeps unsaved bubbles on that page", () => {
    const local = toon([page({ id: "p1" })]);
    const remote = toon([
      page({
        id: "p1",
        fileKey: "new.webp",
        fileUrl: "https://cdn.example/new.webp",
        width: 1152,
        height: 1728,
        bubbles: [],
      }),
    ]);
    const next = mergeReplacedPage(local, remote, "p1");
    expect(next.pages[0].fileKey).toBe("new.webp");
    expect(next.pages[0].fileUrl).toBe("https://cdn.example/new.webp");
    expect(next.pages[0].width).toBe(1152);
    expect(next.pages[0].bubbles[0].textEn).toBe("unsaved");
  });

  it("falls back to the remote toon when that page is not in the payload", () => {
    const remote = toon([page({ id: "p2", fileKey: "other.webp" })]);
    expect(mergeReplacedPage(toon([page({ id: "p1" })]), remote, "missing").pages[0].id).toBe("p2");
  });
});
