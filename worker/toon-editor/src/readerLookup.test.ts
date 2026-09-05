import { describe, expect, it } from "vitest";
import { isReaderLookupPath, normalizeReaderPath, readerStatuses, toonMatchesReaderPath } from "./readerLookup";

describe("readerLookup", () => {
  it("lets Public and Staging load a reader, never Draft", () => {
    expect(readerStatuses()).toEqual(["published", "staging"]);
  });

  it("normalises a reader path", () => {
    expect(normalizeReaderPath("/toons/redsmile/static")).toBe("/toons/redsmile/static/");
    expect(normalizeReaderPath("/DE/toons/jax/the-chip/")).toBe("/toons/jax/the-chip/");
  });

  it("only treats nested /toons/series/ep/ as a reader lookup", () => {
    expect(isReaderLookupPath("/toons/redsmile/static/")).toBe(true);
    expect(isReaderLookupPath("/toons/redsmile/")).toBe(false);
    expect(isReaderLookupPath("/toons/")).toBe(false);
    expect(isReaderLookupPath("/toons/editor/#/")).toBe(false);
  });

  it("matches reader_url or the slug fallback", () => {
    expect(
      toonMatchesReaderPath(
        { slug: "redsmile-static", reader_url: "/toons/redsmile/static/" },
        "/toons/redsmile/static"
      )
    ).toBe(true);
    expect(toonMatchesReaderPath({ slug: "jax", reader_url: null }, "/toons/jax/")).toBe(true);
    expect(toonMatchesReaderPath({ slug: "jax", reader_url: "/toons/jax/the-chip/" }, "/toons/nero/the-dog/")).toBe(
      false
    );
  });
});
