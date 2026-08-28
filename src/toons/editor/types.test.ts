import { describe, expect, it } from "vitest";
import {
  parseDescriptionMap,
  pickDescription,
  statusFromVisibility,
  visibilityFromStatus,
  visibilityLabel,
} from "./types";

describe("toon visibility", () => {
  it("maps stored status onto Draft / Staging / Public", () => {
    expect(visibilityFromStatus("published")).toBe("public");
    expect(visibilityFromStatus("public")).toBe("public");
    expect(visibilityFromStatus("staging")).toBe("staging");
    expect(visibilityFromStatus("draft")).toBe("draft");
    expect(visibilityFromStatus(undefined)).toBe("draft");
    expect(visibilityLabel("published")).toBe("Public");
    expect(visibilityLabel("staging")).toBe("Staging");
    expect(visibilityLabel("draft")).toBe("Draft");
  });

  it("writes Public as published for D1 / catalog", () => {
    expect(statusFromVisibility("public")).toBe("published");
    expect(statusFromVisibility("staging")).toBe("staging");
    expect(statusFromVisibility("draft")).toBe("draft");
  });
});

describe("toon description map", () => {
  it("fills English from the column and keeps other locales", () => {
    const map = parseDescriptionMap({ it: "Ciao", de: "Hallo" }, "Hello");
    expect(map).toEqual({ en: "Hello", it: "Ciao", de: "Hallo", fr: "" });
    expect(pickDescription(map, "it")).toBe("Ciao");
    expect(pickDescription(map, "fr")).toBe("Hello");
  });
});
