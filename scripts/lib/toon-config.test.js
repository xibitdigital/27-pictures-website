import { describe, it, expect } from "vitest";
import { toonFromConfigPath, checkToonConfig, listToonsWithConfig } from "./toon-config.js";

describe("toonFromConfigPath", () => {
  it("pulls the folder name out of a content config path", () => {
    expect(toonFromConfigPath("content/toons/erin-the-revenge/config.json")).toBe("erin-the-revenge");
    expect(toonFromConfigPath("./content/toons/jax/config.json")).toBe("jax");
    expect(toonFromConfigPath("content/toons/nero/README.md")).toBeNull();
    expect(toonFromConfigPath("src/toons/config-lock.json")).toBeNull();
  });
});

describe("checkToonConfig", () => {
  it("finds no reference configs once readers load from D1", () => {
    expect(listToonsWithConfig()).toEqual([]);
  });
});
