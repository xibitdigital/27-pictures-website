import { describe, it, expect } from "vitest";
import {
  documentLocale,
  isLocalizedPath,
  localeAlternates,
  localePath,
  splitLocale,
  isLocale,
  withCaptionLang,
  UI,
  LOCALES,
} from "./i18n";

describe("splitLocale", () => {
  it("reads a locale prefix and the path inside it", () => {
    expect(splitLocale("/de/toons/erin/")).toEqual({ locale: "de", path: "/toons/erin/" });
    expect(splitLocale("/it/toons/")).toEqual({ locale: "it", path: "/toons/" });
  });

  it("treats an unprefixed path as English, which is what the root serves", () => {
    expect(splitLocale("/toons/erin/")).toEqual({ locale: "en", path: "/toons/erin/" });
    expect(splitLocale("/")).toEqual({ locale: "en", path: "/" });
  });

  it("does not mistake a two-letter path segment for a locale", () => {
    // /qr.html and any future two-letter page must survive this.
    expect(splitLocale("/qr.html")).toEqual({ locale: "en", path: "/qr.html" });
    expect(splitLocale("/xx/toons/")).toEqual({ locale: "en", path: "/xx/toons/" });
  });

  it("never produces an /en/ prefix — English is the root", () => {
    expect(splitLocale("/en/toons/")).toEqual({ locale: "en", path: "/en/toons/" });
  });
});

describe("isLocalizedPath", () => {
  it("is true for translated hub pages, not for readers", () => {
    expect(isLocalizedPath("/toons/")).toBe(true);
    expect(isLocalizedPath("/it/toons/")).toBe(true);
    expect(isLocalizedPath("/toons/erin-and-the-goblins/")).toBe(true);
    expect(isLocalizedPath("/fr/toons/erin-and-the-goblins/")).toBe(true);
    expect(isLocalizedPath("/cosplay/")).toBe(true);
    expect(isLocalizedPath("/it/cosplay/")).toBe(true);
    expect(isLocalizedPath("/horror-shorts/the-doll-moved-again/")).toBe(true);
    expect(isLocalizedPath("/")).toBe(true);
    // Readers keep one English URL — their captions are already multilingual.
    expect(isLocalizedPath("/toons/erin/")).toBe(false);
    expect(isLocalizedPath("/qr.html")).toBe(false);
  });
});

describe("localePath", () => {
  it("moves hub pages between locales", () => {
    expect(localePath("/toons/", "de")).toBe("/de/toons/");
    expect(localePath("/de/toons/", "fr")).toBe("/fr/toons/");
    expect(localePath("/fr/toons/", "en")).toBe("/toons/");
    expect(localePath("/toons/erin-and-the-goblins/", "fr")).toBe("/fr/toons/erin-and-the-goblins/");
    expect(localePath("/it/toons/erin-and-the-goblins/", "en")).toBe("/toons/erin-and-the-goblins/");
  });

  it("leaves readers and untranslated pages on their English URL", () => {
    expect(localePath("/toons/erin/", "de")).toBe("/toons/erin/");
    expect(localePath("/de/toons/erin/", "fr")).toBe("/toons/erin/");
    expect(localePath("/qr.html", "it")).toBe("/qr.html");
  });

  it("carries a fragment onto the localized page", () => {
    expect(localePath("/cosplay/", "it")).toBe("/it/cosplay/");
    expect(localePath("/#contact", "it")).toBe("/it/#contact");
    expect(localePath("/de/#contact", "en")).toBe("/#contact");
  });

  it("is idempotent for the locale it is already in", () => {
    expect(localePath("/it/toons/", "it")).toBe("/it/toons/");
    expect(localePath("/toons/", "en")).toBe("/toons/");
  });
});

describe("localeAlternates", () => {
  it("covers every locale plus x-default, so the cluster is complete", () => {
    const alts = localeAlternates("/de/toons/");
    expect(alts.map((a) => a.locale)).toEqual([...LOCALES, "x-default"]);
    expect(alts.find((a) => a.locale === "en")?.path).toBe("/toons/");
    expect(alts.find((a) => a.locale === "x-default")?.path).toBe("/toons/");
    expect(alts.find((a) => a.locale === "de")?.path).toBe("/de/toons/");
  });

  it("is reciprocal: every variant produces the same cluster", () => {
    const from = (p: string) => JSON.stringify(localeAlternates(p));
    expect(from("/toons/")).toBe(from("/de/toons/"));
    expect(from("/de/toons/")).toBe(from("/fr/toons/"));
  });
});

describe("documentLocale", () => {
  const docWith = (lang: string | null) => {
    const doc = document.implementation.createHTMLDocument("t");
    if (lang !== null) doc.documentElement.setAttribute("lang", lang);
    else doc.documentElement.removeAttribute("lang");
    return doc;
  };

  it("reads the page's declared language", () => {
    expect(documentLocale(docWith("de"))).toBe("de");
    expect(documentLocale(docWith("it"))).toBe("it");
  });

  it("accepts a region tag and keeps the language", () => {
    expect(documentLocale(docWith("de-CH"))).toBe("de");
  });

  it("falls back to English for a missing or unknown language", () => {
    expect(documentLocale(docWith(null))).toBe("en");
    expect(documentLocale(docWith("es"))).toBe("en");
  });
});

describe("UI strings", () => {
  it("has every key in every locale", () => {
    const keys = Object.keys(UI.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(UI[locale]).sort(), `locale ${locale}`).toEqual(keys);
      for (const key of keys) expect(UI[locale][key as keyof typeof UI.en], `${locale}.${key}`).toBeTruthy();
    }
  });

  it("knows what a locale is", () => {
    expect(isLocale("de")).toBe(true);
    expect(isLocale("es")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("withCaptionLang", () => {
  it("leaves English hrefs alone", () => {
    expect(withCaptionLang("/toons/nero/", "en")).toBe("/toons/nero/");
  });

  it("adds lang to a reader URL", () => {
    expect(withCaptionLang("/toons/nero/", "fr")).toBe("/toons/nero/?lang=fr");
  });

  it("keeps an existing query and hash", () => {
    expect(withCaptionLang("/toons/nero/?page=12#top", "it")).toBe("/toons/nero/?page=12&lang=it#top");
  });

  it("does not stack a second lang param", () => {
    expect(withCaptionLang("/toons/nero/?lang=fr", "de")).toBe("/toons/nero/?lang=fr");
  });
});
