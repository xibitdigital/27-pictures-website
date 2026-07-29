import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Smoke-tests entry modules: they must call createApp(...).mount(selector)
 * with the correct page prop / root id. Side-effect imports are isolated via
 * vi.resetModules().
 */

describe("site entry modules", () => {
  const mount = vi.fn();
  const directive = vi.fn();
  const createApp = vi.fn(() => ({ directive, mount }));
  const useSmoothScroll = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    mount.mockClear();
    directive.mockClear();
    createApp.mockClear();
    useSmoothScroll.mockClear();

    vi.doMock("vue", async () => {
      const actual = await vi.importActual<typeof import("vue")>("vue");
      return { ...actual, createApp };
    });
    vi.doMock("./composables/useSmoothScroll", () => ({ useSmoothScroll }));
  });

  afterEach(() => {
    vi.doUnmock("vue");
    vi.doUnmock("./composables/useSmoothScroll");
    vi.resetModules();
  });

  it("main.ts mounts SiteApp(home) on #site-app", async () => {
    await import("./main");
    expect(useSmoothScroll).toHaveBeenCalled();
    expect(createApp).toHaveBeenCalled();
    const props = createApp.mock.calls[0][1];
    expect(props).toEqual({ page: "home" });
    expect(directive).toHaveBeenCalledWith("magnetic", expect.anything());
    expect(directive).toHaveBeenCalledWith("reveal", expect.anything());
    expect(mount).toHaveBeenCalledWith("#site-app");
  });

  it("experiments-main.ts mounts SiteApp(experiments) on #site-app", async () => {
    await import("./experiments-main");
    expect(useSmoothScroll).toHaveBeenCalled();
    expect(createApp).toHaveBeenCalled();
    const props = createApp.mock.calls[0][1];
    expect(props).toEqual({ page: "experiments" });
    expect(mount).toHaveBeenCalledWith("#site-app");
  });
});
