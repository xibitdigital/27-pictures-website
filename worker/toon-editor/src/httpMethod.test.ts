import { describe, expect, it } from "vitest";
import { HTTP_METHODS } from "./types";
import { isMethod, parseHttpMethod } from "./httpMethod";

describe("parseHttpMethod", () => {
  it("accepts every known verb, any case", () => {
    for (const verb of HTTP_METHODS) {
      expect(parseHttpMethod(verb)).toBe(verb);
      expect(parseHttpMethod(verb.toLowerCase())).toBe(verb);
    }
  });

  it("rejects unknown verbs", () => {
    expect(parseHttpMethod("TRACE")).toBeNull();
    expect(parseHttpMethod("Gett")).toBeNull();
    expect(parseHttpMethod("")).toBeNull();
  });
});

describe("isMethod", () => {
  it("matches only the expected verb", () => {
    expect(isMethod("get", "GET")).toBe(true);
    expect(isMethod("POST", "GET")).toBe(false);
    expect(isMethod("TRACE", "GET")).toBe(false);
  });
});
