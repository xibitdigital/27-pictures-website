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

  it("paints a visibility badge on the cover", () => {
    const wrapper = mount(ToonCard, {
      props: { title: "Marcus", badge: "Draft", visibility: "draft" },
    });
    const badge = wrapper.get("[data-visibility]");
    expect(badge.text()).toBe("Draft");
    expect(badge.attributes("data-visibility")).toBe("draft");
    expect(badge.classes()).toContain("editor-visibility-badge");
  });
});
