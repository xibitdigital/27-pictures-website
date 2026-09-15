import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { BUBBLE_TAILS, BUBBLE_VARIANTS } from "../mapConfig";
import BubbleLab from "./BubbleLab.vue";

describe("BubbleLab", () => {
  it("renders a stage for every variant and tail", () => {
    const wrapper = mount(BubbleLab);
    expect(wrapper.get("h1").text()).toBe("Bubble lab");
    for (const variant of BUBBLE_VARIANTS) {
      expect(wrapper.find(`[data-variant="${variant}"]`).exists()).toBe(true);
    }
    const first = wrapper.get(`[data-variant="${BUBBLE_VARIANTS[0]}"]`);
    for (const tail of BUBBLE_TAILS) {
      expect(first.find(`[data-tail="${tail}"]`).exists()).toBe(true);
    }
    expect(wrapper.findAll("article[data-tail]")).toHaveLength(BUBBLE_VARIANTS.length * BUBBLE_TAILS.length);
  });

  it("puts the typed line on every caption", async () => {
    const wrapper = mount(BubbleLab);
    await wrapper.get('input[name="lab-line"]').setValue("Too slow.");
    const texts = wrapper.findAll("article[data-tail] .toon-word-text").map((node) => node.text());
    expect(texts.length).toBe(BUBBLE_VARIANTS.length * BUBBLE_TAILS.length);
    expect(new Set(texts)).toEqual(new Set(["Too slow."]));
  });

  it("renders a reshape-fit stage for each stand-in scale", () => {
    const wrapper = mount(BubbleLab);
    const section = wrapper.get('[data-variant="reshape-fit"]');
    const cells = section.findAll("article[data-reshape]");
    expect(cells.length).toBeGreaterThan(0);
    const keys = cells.map((cell) => cell.attributes("data-reshape"));
    expect(keys).toContain("lopsided");
    expect(keys).toContain("wide-short");
    for (const cell of cells) {
      expect(cell.find(".toon-word-text").exists()).toBe(true);
    }
  });
});
