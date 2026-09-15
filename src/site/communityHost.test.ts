import { describe, expect, it } from "vitest";
import { isCommunityHost, isCommunityOrigin } from "./communityHost";
import { applyCommunityHomeHtml, communityRedirect, communityUsername } from "./communityPages";
import type { CatalogPayload } from "./catalogRender";

const payload: CatalogPayload = {
  series: [
    {
      key: "demo",
      title: "Demo",
      tagline: "",
      description: "A book.",
      coverUrl: null,
      hubUrl: "/toons/demo/",
      ownerUsername: "marco",
      episodes: [
        {
          id: "demo-ep",
          slug: "demo-ep",
          title: "Episode 1",
          subtitle: "",
          description: "",
          coverUrl: null,
          pageCount: 3,
          readerUrl: "/toons/demo/ep1/",
          n: 1,
          ownerUsername: "marco",
        },
      ],
    },
  ],
  ungrouped: [],
};

describe("community host", () => {
  it("recognises production and local hosts", () => {
    expect(isCommunityHost("toons.twentyseven.pictures")).toBe(true);
    expect(isCommunityHost("toons.localhost")).toBe(true);
    expect(isCommunityHost("twentyseven.pictures")).toBe(false);
    expect(isCommunityOrigin("https://toons.twentyseven.pictures")).toBe(true);
  });

  it("redirects studio paths and the /toons/ catalog to the right origin", () => {
    expect(communityRedirect("https://toons.twentyseven.pictures/toons/")).toBe("https://toons.twentyseven.pictures/");
    expect(communityRedirect("https://toons.twentyseven.pictures/cosplay/")).toBe(
      "https://twentyseven.pictures/cosplay/"
    );
    expect(communityRedirect("https://toons.twentyseven.pictures/toons/editor/")).toBe(
      "https://twentyseven.pictures/toons/editor/"
    );
    expect(communityRedirect("https://toons.twentyseven.pictures/")).toBeNull();
    expect(communityRedirect("https://toons.twentyseven.pictures/toons/demo/")).toBeNull();
  });

  it("parses a creator username and rejects reserved segments", () => {
    expect(communityUsername("/marco/")).toBe("marco");
    expect(communityUsername("/toons/")).toBeNull();
    expect(communityUsername("/cosplay/")).toBeNull();
    expect(communityUsername("/marco/extra/")).toBeNull();
  });

  it("stamps the community catalog and a portfolio", () => {
    const html = `<!doctype html><html><head>
      <title>old</title>
      <link rel="canonical" href="https://toons.twentyseven.pictures/" />
      <meta name="description" content="old" />
      <meta property="og:url" content="old" />
      <meta property="og:title" content="old" />
      <meta property="og:description" content="old" />
      <meta name="twitter:title" content="old" />
      <meta name="twitter:description" content="old" />
      <script type="application/ld+json" data-toon-jsonld>{ "@graph": [] }</script>
    </head><body>
      <nav class="page-breadcrumb"><ol></ol></nav>
      <h1 data-community-title>old</h1>
      <p data-community-lead>old</p>
      <div class="series-grid" data-toon-catalog></div>
      <section data-community-editors-wrap hidden><div data-community-editors></div></section>
    </body></html>`;
    const home = applyCommunityHomeHtml(html, payload, "https://toons.twentyseven.pictures/");
    expect(home).toContain("FlipFrame | Interactive Toons");
    expect(home).toContain('href="/toons/demo/"');
    expect(home).not.toContain('href="/marco/"');

    const portfolio = applyCommunityHomeHtml(html, payload, "https://toons.twentyseven.pictures/marco/", "marco");
    expect(portfolio).toContain("marco — FlipFrame toons");
    expect(portfolio).toContain('href="/toons/demo/"');
    expect(portfolio).not.toContain('href="/marco/"');
  });
});
