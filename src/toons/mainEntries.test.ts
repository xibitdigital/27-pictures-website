import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("toon entry modules", () => {
  const mount = vi.fn();
  const createApp = vi.fn(() => ({ mount }));

  beforeEach(() => {
    vi.resetModules();
    mount.mockClear();
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

  it("jax-the-chip/main.ts mounts JaxApp on #app", async () => {
    await import("./jax-the-chip/main");
    expect(createApp).toHaveBeenCalled();
    expect(mount).toHaveBeenCalledWith("#app");
  });

  it("erin/main.ts mounts ErinApp on #app", async () => {
    await import("./erin/main");
    expect(createApp).toHaveBeenCalled();
    expect(mount).toHaveBeenCalledWith("#app");
  });

  it("nero-the-dog/main.ts mounts NeroApp on #app", async () => {
    await import("./nero-the-dog/main");
    expect(createApp).toHaveBeenCalled();
    expect(mount).toHaveBeenCalledWith("#app");
  });

  it("redsmile-static/main.ts mounts RedSmileStaticApp on #app", async () => {
    await import("./redsmile-static/main");
    expect(createApp).toHaveBeenCalled();
    expect(mount).toHaveBeenCalledWith("#app");
  });
});
