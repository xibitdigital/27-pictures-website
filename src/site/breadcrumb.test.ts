import { describe, expect, it } from "vitest";
import { breadcrumbListJsonLd, breadcrumbNavHtml, toonTrail } from "./breadcrumb";

const series = { title: "RED SMILE", hubUrl: "/toons/redsmile/" };

describe("toonTrail", () => {
  it("catalog: Home current Toons", () => {
    expect(toonTrail({ locale: "en" })).toEqual([{ href: "/", name: "Home" }, { name: "Toons" }]);
    expect(toonTrail({ locale: "de" })).toEqual([{ href: "/de/", name: "Start" }, { name: "Toons" }]);
  });

  it("hub: Home / Toons / series", () => {
    expect(toonTrail({ locale: "en", series })).toEqual([
      { href: "/", name: "Home" },
      { href: "/toons/", name: "Toons" },
      { name: "RED SMILE" },
    ]);
    expect(toonTrail({ locale: "de", series })[1]?.href).toBe("/de/toons/");
  });

  it("reader: Home / Toons / series / episode", () => {
    expect(toonTrail({ locale: "en", series, episodeName: "static" })).toEqual([
      { href: "/", name: "Home" },
      { href: "/toons/", name: "Toons" },
      { href: "/toons/redsmile/", name: "RED SMILE" },
      { name: "static" },
    ]);
  });
});

describe("breadcrumbNavHtml / JSON-LD", () => {
  it("stamps one nav and the same names into schema", () => {
    const items = toonTrail({ locale: "en", series, episodeName: "static" });
    const html = breadcrumbNavHtml(items, "Breadcrumb");
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/toons/redsmile/"');
    expect(html).toContain('aria-current="page">static</li>');
    const ld = breadcrumbListJsonLd(
      items,
      "https://twentyseven.pictures/toons/redsmile/static/",
      "https://twentyseven.pictures"
    );
    expect(ld.itemListElement.map((el) => el.name)).toEqual(["Home", "Toons", "RED SMILE", "static"]);
    expect(ld.itemListElement[3]?.item).toBe("https://twentyseven.pictures/toons/redsmile/static/");
  });
});
