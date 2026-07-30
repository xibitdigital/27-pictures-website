import { describe, it, expect } from "vitest";
import { toonConfigUrl, toonConfigLock, devToonConfigUrl, isDevToonConfigUrl } from "./configUrls";

describe("toonConfigUrl", () => {
  it("keeps hashed lock entries for production deploys", () => {
    expect(toonConfigLock.jax).toMatch(/^config\.[a-f0-9]{32}\.json$/);
    expect(toonConfigLock.erin).toMatch(/^config\.[a-f0-9]{32}\.json$/);
  });

  it("uses local dev middleware paths outside production builds", () => {
    // Vitest runs with PROD=false → same path as `vite` / `make dev`
    expect(import.meta.env.PROD).toBe(false);
    expect(toonConfigUrl("jax")).toBe("/__dev/toon-config/jax.json");
    expect(toonConfigUrl("erin")).toBe("/__dev/toon-config/erin.json");
  });

  it("exposes stable dev middleware helpers", () => {
    expect(devToonConfigUrl("jax")).toBe("/__dev/toon-config/jax.json");
    expect(isDevToonConfigUrl("/__dev/toon-config/jax.json")).toBe(true);
    expect(isDevToonConfigUrl("/toons/jax/config.abc.json")).toBe(false);
  });
});
