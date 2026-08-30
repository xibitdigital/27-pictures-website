import { describe, it, expect } from "vitest";
import { continueReadingTiles, type RowEpisode } from "./toonRows";
import type { ReadingProgress } from "../toons/bookReader/readingProgress";

const EPISODES: RowEpisode[] = [
  {
    id: "erin",
    n: 1,
    title: "The Missing Child",
    url: "/toons/erin-and-the-goblins/the-missing-child/",
    pages: 27,
    seriesTitle: "Erin & the Goblins",
    seriesEpisodeCount: 2,
    coverUrl: "https://cdn.example/erin.jpg",
  },
  {
    id: "erin-the-revenge",
    n: 2,
    title: "The Revenge",
    url: "/toons/erin-and-the-goblins/the-revenge/",
    pages: 23,
    seriesTitle: "Erin & the Goblins",
    seriesEpisodeCount: 2,
  },
  {
    id: "nero",
    n: 1,
    title: "Nero",
    url: "/toons/nero/the-dog/",
    pages: 20,
    seriesTitle: "Nero",
    coverUrl: "https://cdn.example/nero.jpg",
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
    expect(tiles[0]).toContain("/toons/nero/the-dog/");
    expect(tiles[1]).toContain("/toons/erin-and-the-goblins/the-missing-child/");
  });

  it("deep-links to the stored page and shows how far in", () => {
    const [nero] = continueReadingTiles(EPISODES, read);
    expect(nero).toContain('href="/toons/nero/the-dog/?page=12"');
    expect(nero).toContain("Page 12 of 20");
    expect(nero).toContain("--read: 60%");
  });

  it("renders nothing when no book has been started", () => {
    expect(continueReadingTiles(EPISODES, () => null)).toEqual([]);
  });
});
