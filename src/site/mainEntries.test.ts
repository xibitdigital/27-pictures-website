import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Smoke-tests entry modules: they must call createApp(...).mount(selector)
 * with the correct page prop / root id. Side-effect imports are isolated via
 * vi.resetModules().
 */

describe("site entry modules", () => {
  const mount = vi.fn();
  const directive = vi.fn();
  // Accept root + props so mock.calls typing matches createApp(Component, props?).
  const createApp = vi.fn((..._args: unknown[]) => ({ directive, mount }));

  beforeEach(() => {
    vi.resetModules();
    mount.mockClear();
    directive.mockClear();
    createApp.mockClear();

    vi.doMock("vue", async () => {
      const actual = await vi.importActual<typeof import("vue")>("vue");
      return { ...actual, createApp };
    });
  });

  afterEach(() => {
    vi.doUnmock("vue");
    vi.resetModules();
  });

  it("main.ts mounts SiteApp(home) on #site-app", async () => {
    await import("./main");
    expect(createApp).toHaveBeenCalledWith(expect.anything(), { page: "home" });
    expect(directive).toHaveBeenCalledWith("magnetic", expect.anything());
    expect(directive).toHaveBeenCalledWith("reveal", expect.anything());
    expect(mount).toHaveBeenCalledWith("#site-app");
  });

  it("experimentsMain.ts mounts SiteApp(experiments) on #site-app", async () => {
    await import("./experimentsMain");
    expect(createApp).toHaveBeenCalledWith(expect.anything(), { page: "experiments" });
    expect(mount).toHaveBeenCalledWith("#site-app");
  });
});
