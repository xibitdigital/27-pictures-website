import { describe, it, expect } from "vitest";
import { continueReadingTiles } from "./toonRows";
import type { Episode } from "../toons/series";
import type { ReadingProgress } from "../toons/bookReader/readingProgress";

type SeriesEpisode = Episode & { seriesTitle: string };

const EPISODES: SeriesEpisode[] = [
  {
    id: "erin",
    n: 1,
    title: "The Missing Child",
    url: "/toons/erin/",
    pages: 27,
    status: "published",
    seriesTitle: "Erin & the Goblins",
    art: "erin.jpg",
  },
  {
    id: "erin-the-revenge",
    n: 2,
    title: "The Revenge",
    url: "/toons/erin-the-revenge/",
    pages: 23,
    status: "draft",
    seriesTitle: "Erin & the Goblins",
    art: "erin-the-revenge-intro.jpg",
  },
  {
    id: "nero",
    n: 1,
    title: "Nero",
    url: "/toons/nero/",
    pages: 20,
    status: "published",
    seriesTitle: "Nero",
    art: "nero.jpg",
  },
];

describe("continueReadingTiles", () => {
  const progress: Record<string, ReadingProgress> = {
    erin: { page: 5, pages: 27, at: 1000 },
    nero: { page: 12, pages: 20, at: 5000 },
  };
  const read = (id: string) => progress[id] ?? null;

  it("lists only books with stored progress, most recent first", () => {
    const tiles = continueReadingTiles(EPISODES, read);
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toContain("/toons/nero/");
    expect(tiles[1]).toContain("/toons/erin/");
  });

  it("deep-links to the stored page and shows how far in", () => {
    const [nero] = continueReadingTiles(EPISODES, read);
    expect(nero).toContain('href="/toons/nero/?page=12"');
    expect(nero).toContain("Page 12 of 20");
    expect(nero).toContain("--read: 60%");
  });

  it("renders nothing when no book has been started", () => {
    expect(continueReadingTiles(EPISODES, () => null)).toEqual([]);
  });
});
