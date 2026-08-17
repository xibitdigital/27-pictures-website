import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createToonCaptions } from "./useToonCaptions";

const CONFIG = {
  title: "Erin",
  defaultLang: "en",
  languages: [
    { code: "en", label: "EN" },
    { code: "de", label: "DE" },
    { code: "it", label: "IT" },
    { code: "fr", label: "FR" },
  ],
  pages: [{ file: "assets/a.jpg", words: [] }],
};

function serveConfig() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(CONFIG), { status: 200 }));
}

async function load(pageLang: string | null) {
  if (pageLang === null) document.documentElement.removeAttribute("lang");
  else document.documentElement.setAttribute("lang", pageLang);
  const store = createToonCaptions({
    configUrl: "/config.json",
    pageDir: "/toons/erin/",
    langStorageKey: "erin-toon-lang",
    preloadSfx: false,
  });
  await store.load();
  return store;
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  serveConfig();
});
afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.setAttribute("lang", "en");
  window.history.replaceState(null, "", "/");
});

describe("caption language on a locale page", () => {
  it("opens in the page's language when the book has it", async () => {
    expect((await load("de")).lang.value).toBe("de");
  });

  it("accepts a region tag", async () => {
    expect((await load("de-CH")).lang.value).toBe("de");
  });

  it("falls back to the book's default when the page language is not translated", async () => {
    expect((await load("es")).lang.value).toBe("en");
  });

  it("lets a stored choice win, or the switcher would be undone on reload", async () => {
    window.localStorage.setItem("erin-toon-lang", "it");
    expect((await load("de")).lang.value).toBe("it");
  });

  it("is English on an undeclared page", async () => {
    expect((await load(null)).lang.value).toBe("en");
  });

  it("opens in the landing-page locale when the reader itself is English", async () => {
    window.localStorage.setItem("27p-locale", "it");
    expect((await load("en")).lang.value).toBe("it");
  });

  it("lets a later landing-page visit beat a stale reader choice", async () => {
    window.localStorage.setItem("erin-toon-lang", "en");
    window.localStorage.setItem("erin-toon-lang-at", "1");
    window.localStorage.setItem("27p-locale", "fr");
    window.localStorage.setItem("27p-locale-at", "9");
    expect((await load("en")).lang.value).toBe("fr");
  });

  it("still lets a newer reader switcher choice beat the landing-page hint", async () => {
    window.localStorage.setItem("27p-locale", "de");
    window.localStorage.setItem("27p-locale-at", "1");
    window.localStorage.setItem("erin-toon-lang", "it");
    window.localStorage.setItem("erin-toon-lang-at", "9");
    expect((await load("en")).lang.value).toBe("it");
  });

  it("opens in ?lang= even when a stored choice exists", async () => {
    window.localStorage.setItem("erin-toon-lang", "en");
    window.localStorage.setItem("erin-toon-lang-at", "99");
    window.history.replaceState(null, "", "/toons/erin/?lang=fr");
    expect((await load("en")).lang.value).toBe("fr");
    window.history.replaceState(null, "", "/");
  });
});
