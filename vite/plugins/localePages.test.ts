import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateLocalePages, localizePageUrl, renderLocalePage, LOCALE_PAGES, PAGE_LOCALES } from "./localePages";

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <title data-i18n="title">Interactive Toons</title>
    <link rel="canonical" href="https://twentyseven.pictures/toons/" />
    <meta property="og:url" content="https://twentyseven.pictures/toons/" />
    <meta property="og:locale" content="en_US" />
    <meta name="description" data-i18n-content="description" content="English desc" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            "@id": "https://twentyseven.pictures/toons/#webpage",
            "url": "https://twentyseven.pictures/toons/",
            "name": "Interactive Toons",
            "inLanguage": "en"
          },
          {
            "@type": "CreativeWork",
            "@id": "https://twentyseven.pictures/toons/erin/#work",
            "url": "https://twentyseven.pictures/toons/erin/",
            "name": "Erin"
          }
        ]
      }
    </script>
  </head>
  <body>
    <h1 data-i18n="h1">Interactive Toons</h1>
    <p data-i18n-html="lead">Hello <strong>27 Pictures</strong></p>
    <img data-i18n-alt="neroAlt" alt="English alt" />
    <a href="/toons/nero/">Nero</a>
  </body>
</html>
`;

const COPY = {
  title: "Toon interattivi",
  description: "Desc IT",
  h1: "Toon interattivi",
  lead: "Ciao <strong>27 Pictures</strong>",
  neroAlt: "Alt IT",
  schema: { name: "Toon interattivi | 27 Pictures" },
};

describe("renderLocalePage", () => {
  it("emits unique crawlable HTML for the locale", () => {
    const html = renderLocalePage(TEMPLATE, "it", COPY, "/toons/");
    expect(html).toContain('<html lang="it">');
    expect(html).toContain("<title>Toon interattivi</title>");
    expect(html).toContain("<h1>Toon interattivi</h1>");
    expect(html).toContain("Ciao <strong>27 Pictures</strong>");
    expect(html).toContain('content="Desc IT"');
    expect(html).toContain('alt="Alt IT"');
    expect(html).toContain('og:locale" content="it_IT"');
    expect(html).toContain("<!-- generated from the English template");
  });

  it("rewrites the landing URL and leaves reader URLs on English", () => {
    const html = renderLocalePage(TEMPLATE, "it", COPY, "/toons/");
    expect(html).toContain('href="https://twentyseven.pictures/it/toons/"');
    expect(html).toContain('"url": "https://twentyseven.pictures/it/toons/"');
    expect(html).toContain('"@id": "https://twentyseven.pictures/it/toons/#webpage"');
    expect(html).toContain("https://twentyseven.pictures/toons/erin/");
    expect(html).not.toContain("https://twentyseven.pictures/it/toons/erin/");
    expect(html).toContain('href="/toons/nero/?lang=it"');
  });

  it("prefixes localized hub pages instead of adding ?lang=", () => {
    const src = `<!doctype html>
<html lang="en">
  <body>
    <a href="/toons/">Index</a>
    <a href="/toons/erin-and-the-goblins/">Series</a>
    <a href="/toons/erin/">Reader</a>
  </body>
</html>
`;
    const html = renderLocalePage(src, "fr", {}, "/toons/");
    expect(html).toContain('href="/fr/toons/"');
    expect(html).toContain('href="/fr/toons/erin-and-the-goblins/"');
    expect(html).toContain('href="/toons/erin/?lang=fr"');
  });

  it("keeps the hreflang cluster pointing at every language, including English", () => {
    const withCluster = TEMPLATE.replace(
      "</head>",
      `    <link rel="alternate" hreflang="en" href="https://twentyseven.pictures/toons/" />
    <link rel="alternate" hreflang="it" href="https://twentyseven.pictures/it/toons/" />
    <link rel="alternate" hreflang="x-default" href="https://twentyseven.pictures/toons/" />
  </head>`
    );
    const html = renderLocalePage(withCluster, "it", COPY, "/toons/");
    expect(html).toContain('hreflang="en" href="https://twentyseven.pictures/toons/"');
    expect(html).toContain('hreflang="x-default" href="https://twentyseven.pictures/toons/"');
    expect(html).toContain('hreflang="it" href="https://twentyseven.pictures/it/toons/"');
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/twentyseven\.pictures\/it\/toons\/"/);
  });

  it("sets CollectionPage inLanguage and schema name", () => {
    const html = renderLocalePage(TEMPLATE, "de", { ...COPY, schema: { name: "Interaktive Toons" } }, "/toons/");
    expect(html).toContain('"inLanguage": "de"');
    expect(html).toContain('"name": "Interaktive Toons"');
  });

  it("strips data-i18n attributes from the generated file", () => {
    const html = renderLocalePage(TEMPLATE, "fr", COPY, "/toons/");
    expect(html).not.toContain("data-i18n");
  });

  it("does not swallow following cards when Prettier splits a closing tag", () => {
    const pretty = `<!doctype html>
<html lang="en">
  <body>
    <a href="/toons/nero/"><span data-i18n="neroDesc"
      >English nero</span
    ></a>
    <a href="/toons/jax/"><span data-i18n="jaxDesc"
      >English jax</span
    ></a>
  </body>
</html>
`;
    const html = renderLocalePage(pretty, "fr", { neroDesc: "Nero FR", jaxDesc: "Jax FR" }, "/toons/");
    expect(html).toContain("Nero FR");
    expect(html).toContain("Jax FR");
    expect(html).toContain('href="/toons/nero/?lang=fr"');
    expect(html).toContain('href="/toons/jax/?lang=fr"');
  });

  it("keeps English when a key is missing", () => {
    const html = renderLocalePage(TEMPLATE, "it", { title: "IT" }, "/toons/");
    expect(html).toContain("<h1>Interactive Toons</h1>");
  });
});

describe("localizePageUrl", () => {
  it("only rewrites the page itself, not child paths", () => {
    expect(localizePageUrl("https://twentyseven.pictures/toons/", "/toons/", "fr")).toBe(
      "https://twentyseven.pictures/fr/toons/"
    );
    expect(localizePageUrl("https://twentyseven.pictures/toons/#itemlist", "/toons/", "fr")).toBe(
      "https://twentyseven.pictures/fr/toons/#itemlist"
    );
    expect(localizePageUrl("https://twentyseven.pictures/toons/jax/", "/toons/", "fr")).toBe(
      "https://twentyseven.pictures/toons/jax/"
    );
  });
});

it("renders the real toons landing template into Italian", () => {
  const src = path.resolve(__dirname, "../../src");
  const template = fs.readFileSync(path.join(src, "toons/index.html"), "utf8");
  const copy = JSON.parse(fs.readFileSync(path.join(src, "site/locales/toons-index/it.json"), "utf8")) as Record<
    string,
    unknown
  >;
  const html = renderLocalePage(template, "it", copy as never, "/toons/");
  expect(html).toContain("<h1>Toon interattivi</h1>");
  expect(html).toContain('hreflang="en" href="https://twentyseven.pictures/toons/"');
  expect(html).toContain('hreflang="x-default" href="https://twentyseven.pictures/toons/"');
  expect(html).toContain('rel="canonical" href="https://twentyseven.pictures/it/toons/"');
  expect(html).toContain('"inLanguage": "it"');
  expect(html).toContain('href="/toons/nero/?lang=it"');
  expect(html).toContain('href="/it/toons/erin-and-the-goblins/"');
  expect(html).not.toContain("https://twentyseven.pictures/it/toons/nero/");
  expect(html).not.toContain("data-i18n");
});

describe("generateLocalePages", () => {
  let root: string;

  // One fixture per real entry, so adding a page to LOCALE_PAGES cannot pass
  // here while the copy or template it names is missing.
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "locale-pages-"));
    for (const page of LOCALE_PAGES) {
      const template = path.join(root, page.template);
      fs.mkdirSync(path.dirname(template), { recursive: true });
      fs.writeFileSync(template, TEMPLATE);
      fs.mkdirSync(path.join(root, page.copyDir), { recursive: true });
      for (const locale of PAGE_LOCALES) {
        fs.writeFileSync(path.join(root, page.copyDir, `${locale}.json`), JSON.stringify(COPY));
      }
    }
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("writes one HTML file per locale under src/<locale>/", () => {
    const written = generateLocalePages(root);
    expect(written).toHaveLength(LOCALE_PAGES.length * PAGE_LOCALES.length);
    expect(fs.existsSync(path.join(root, "it/toons/index.html"))).toBe(true);
    expect(fs.readFileSync(path.join(root, "de/toons/index.html"), "utf8")).toContain('<html lang="de">');
    expect(fs.readFileSync(path.join(root, "fr/toons/index.html"), "utf8")).toContain('<html lang="fr">');
  });
});
