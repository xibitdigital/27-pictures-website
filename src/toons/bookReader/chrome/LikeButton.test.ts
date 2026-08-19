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

  it("fills the heart, stores the vote and then retires the control", async () => {
    const wrapper = mount(LikeButton, { props: { toonId: "jax" } });
    await nextTick();

    const btn = wrapper.get("button");
    expect(btn.attributes("aria-pressed")).toBe("false");
    expect(btn.attributes("disabled")).toBeUndefined();
    expect(btn.classes()).not.toContain("is-liked");

    await btn.trigger("click");
    await nextTick();

    expect(btn.attributes("aria-pressed")).toBe("true");
    expect(btn.classes()).toContain("is-liked");
    expect(window.localStorage.getItem(`${LIKE_STORAGE_PREFIX}jax`)).toBe("1");
    // A vote is final on this device: still a filled red heart, no longer a
    // control. `is-liked` stays so the CSS keeps painting it brand red.
    expect(btn.attributes("disabled")).toBeDefined();
  });

  it("mounts already disabled when this device has voted before", async () => {
    window.localStorage.setItem(`${LIKE_STORAGE_PREFIX}erin`, "1");
    const wrapper = mount(LikeButton, { props: { toonId: "erin" } });
    await nextTick();

    const btn = wrapper.get("button");
    expect(btn.classes()).toContain("is-liked");
    expect(btn.attributes("disabled")).toBeDefined();
    expect(btn.attributes("aria-label")).toBe("Liked");
  });

  it("hides the count when there is no total to show", async () => {
    // No likes API configured, so the composable never resolves a total —
    // the button renders without a counter rather than with a zero.
    const wrapper = mount(LikeButton, { props: { toonId: "nero" } });
    await flushPromises();

    expect(wrapper.find(".toon-like-count").exists()).toBe(false);
  });

  it("shows the total to everyone, with no ?stats gate", async () => {
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

  it("keeps the vote while the like POST is still in flight", async () => {
    vi.stubEnv("VITE_LIKES_API", "https://likes.example.dev");
    // A POST that never settles — the shape of a slow request or an origin the
    // Worker's CORS list does not cover. The vote is local state and was
    // already written, so a hung request must not leave the heart looking
    // uncertain or hand the reader a second press.
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));

    const wrapper = mount(LikeButton, { props: { toonId: "nero" } });
    await flushPromises();

    await wrapper.get("button").trigger("click");
    await nextTick();

    const btn = wrapper.get("button");
    expect(btn.attributes("aria-pressed")).toBe("true");
    expect(btn.classes()).toContain("is-liked");
    expect(btn.attributes("disabled")).toBeDefined();
    expect(window.localStorage.getItem(`${LIKE_STORAGE_PREFIX}nero`)).toBe("1");
  });
});
