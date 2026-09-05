import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ToonCard from "./ToonCard.vue";

vi.mock("vue-router", () => ({
  RouterLink: { template: '<a class="series-card"><slot /></a>' },
}));

describe("ToonCard", () => {
  it("renders the site series-card for a live preview", () => {
    const wrapper = mount(ToonCard, {
      props: {
        title: "Jax",
        meta: "Cyberpunk Chronicles",
        cue: "Public",
        description: "A netrunner dying by inches.",
        coverUrl: "https://cdn.example/jax.jpg",
      },
    });
    expect(wrapper.classes()).toContain("series-card");
    expect(wrapper.get(".series-card-title").text()).toBe("Jax");
    expect(wrapper.get(".series-card-meta").text()).toBe("Cyberpunk Chronicles");
    expect(wrapper.get(".series-card-desc").text()).toContain("netrunner");
    expect(wrapper.get("img").attributes("src")).toContain("jax.jpg");
  });

  it("renders an add card with a plus and no cover image", () => {
    const wrapper = mount(ToonCard, {
      props: { add: true, to: "/new?series=erin&episode=3", title: "Add episode" },
    });
    expect(wrapper.classes()).toContain("series-card--add");
    expect(wrapper.attributes("aria-label")).toBe("Add episode");
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.find(".editor-cover-placeholder").exists()).toBe(false);
    expect(wrapper.get("[aria-hidden='true']").text()).toBe("+");
  });

  it("holds a 2:3 placeholder when there is no cover", () => {
    const wrapper = mount(ToonCard, {
      props: { title: "Untitled series" },
    });
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.get(".editor-cover-placeholder").exists()).toBe(true);
  });

  it("paints a visibility badge on the cover", () => {
    const wrapper = mount(ToonCard, {
      props: { title: "Marcus", badge: "Draft", visibility: "draft" },
    });
    const badge = wrapper.get("[data-visibility]");
    expect(badge.text()).toBe("Draft");
    expect(badge.attributes("data-visibility")).toBe("draft");
    expect(badge.classes()).toContain("editor-visibility-badge");
  });

  it("copies the public link from the share control", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const wrapper = mount(ToonCard, {
      props: { title: "Jax", shareHref: "/toons/jax/the-chip/" },
    });
    await wrapper.get('button[name="share-toon"]').trigger("click");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/toons/jax/the-chip/"));
  });

  it("does not show a share control on add cards", () => {
    const wrapper = mount(ToonCard, {
      props: { add: true, to: "/new", title: "Add episode", shareHref: "/toons/erin/" },
    });
    expect(wrapper.find('button[name="share-toon"]').exists()).toBe(false);
  });
});
