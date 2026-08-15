/**
 * Toon series and their episodes.
 *
 * One place that knows a book is part of something. Readers use it for the
 * back-cover "next episode" link; `/toons/` uses the same shape for its
 * series groups and CreativeWorkSeries schema.
 *
 * `status` is what the site keys visibility off:
 *   published — listed, indexable
 *   draft     — reachable by URL, unlisted, noindex (see CLAUDE.md)
 *   soon      — no reader yet; renders as "coming soon" on the back cover
 */
export type EpisodeStatus = "published" | "draft" | "soon";

export interface Episode {
  /** Toon id — matches content/toons/<id>/ and config-lock.json. Absent for `soon`. */
  id?: string;
  /** Episode number within the series. */
  n: number;
  title: string;
  url?: string;
  pages?: number;
  status: EpisodeStatus;
}

export interface Series {
  key: string;
  title: string;
  /** Short line under the series title in the index. */
  tagline: string;
  episodes: Episode[];
}

export const SERIES: Series[] = [
  {
    key: "erin",
    title: "Erin & the Goblins",
    tagline: "Dark fantasy · a town that is really a door",
    episodes: [
      {
        id: "erin",
        n: 1,
        title: "The Missing Child",
        url: "/toons/erin/",
        pages: 27,
        status: "published",
      },
      {
        id: "erin-the-revenge",
        n: 2,
        title: "The Revenge",
        url: "/toons/erin-the-revenge/",
        pages: 17,
        status: "draft",
      },
      { n: 3, title: "Coming soon", status: "soon" },
    ],
  },
  {
    key: "jax",
    title: "Jax",
    tagline: "Cyberpunk · a netrunner robbing the people who own minds",
    episodes: [{ id: "jax", n: 1, title: "Jax", url: "/toons/jax/", status: "published" }],
  },
  {
    key: "nero",
    title: "Nero",
    tagline: "Cyberpunk noir · a Scotland Yard case in the rain",
    episodes: [{ id: "nero", n: 1, title: "Nero", url: "/toons/nero/", pages: 20, status: "published" }],
  },
  {
    key: "red-smile",
    title: "RED SMILE",
    tagline: "Horror · the anthology, as something you read",
    episodes: [
      {
        id: "redsmile-static",
        n: 1,
        title: "static",
        url: "/toons/redsmile-static/",
        pages: 12,
        status: "published",
      },
    ],
  },
];

export interface EpisodeNav {
  seriesTitle: string;
  /** Episode label of the book being read, e.g. "Episode 2". */
  current: string;
  prev?: { href: string; label: string };
  /** Absent href = the next episode exists on paper but has no reader yet. */
  next?: { href?: string; label: string };
}

function findSeries(toonId: string): { series: Series; index: number } | null {
  for (const series of SERIES) {
    const index = series.episodes.findIndex((e) => e.id === toonId);
    if (index >= 0) return { series, index };
  }
  return null;
}

/**
 * Back-cover navigation for a toon, or null when it is a standalone book —
 * a one-episode series has nothing to link to and keeps the plain back link.
 */
export function episodeNav(toonId: string): EpisodeNav | null {
  const found = findSeries(toonId);
  if (!found) return null;
  const { series, index } = found;
  if (series.episodes.length < 2) return null;

  const prevEp = series.episodes[index - 1];
  const nextEp = series.episodes[index + 1];

  return {
    seriesTitle: series.title,
    current: `Episode ${series.episodes[index].n}`,
    prev: prevEp?.url ? { href: prevEp.url, label: `Episode ${prevEp.n} — ${prevEp.title}` } : undefined,
    next: nextEp
      ? {
          href: nextEp.status === "soon" ? undefined : nextEp.url,
          label:
            nextEp.status === "soon" ? `Episode ${nextEp.n} — coming soon` : `Episode ${nextEp.n} — ${nextEp.title}`,
        }
      : undefined,
  };
}
