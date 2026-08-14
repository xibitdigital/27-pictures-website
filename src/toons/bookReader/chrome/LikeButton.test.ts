import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import LikeButton from "./LikeButton.vue";
import { LIKE_STORAGE_PREFIX } from "../useToonLikes";

function setSearch(search: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, search },
  });
}

describe("LikeButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    setSearch("");
  });

  it("toggles the heart and stores the vote", async () => {
    const wrapper = mount(LikeButton, { props: { toonId: "jax" } });
    await nextTick();

    const btn = wrapper.get("button");
    expect(btn.attributes("aria-pressed")).toBe("false");
    expect(btn.classes()).not.toContain("is-liked");

    await btn.trigger("click");
    await nextTick();

    expect(btn.attributes("aria-pressed")).toBe("true");
    expect(btn.classes()).toContain("is-liked");
    expect(window.localStorage.getItem(`${LIKE_STORAGE_PREFIX}jax`)).toBe("1");
  });

  it("hides the count unless ?stats=true", async () => {
    vi.stubEnv("VITE_LIKES_API", "https://likes.example.dev");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ toon: "nero", likes: 12 }), { status: 200 })
    );

    const wrapper = mount(LikeButton, { props: { toonId: "nero" } });
    await flushPromises();

    expect(wrapper.find(".toon-like-count").exists()).toBe(false);
  });

  it("shows the total with ?stats=true", async () => {
    setSearch("?stats=true");
    vi.stubEnv("VITE_LIKES_API", "https://likes.example.dev");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ toon: "nero", likes: 12 }), { status: 200 })
    );

    const wrapper = mount(LikeButton, { props: { toonId: "nero" } });
    await flushPromises();

    expect(wrapper.get(".toon-like-count").text()).toBe("12");
  });

  it("keeps an accessible label", async () => {
    const wrapper = mount(LikeButton, { props: { toonId: "erin" } });
    await nextTick();
    expect(wrapper.get("button").attributes("aria-label")).toBe("Like this toon");
    await wrapper.get("button").trigger("click");
    await nextTick();
    expect(wrapper.get("button").attributes("aria-label")).toBe("Liked");
  });
});
