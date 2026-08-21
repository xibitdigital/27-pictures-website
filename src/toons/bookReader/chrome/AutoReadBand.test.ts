import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AutoReadBand from "./AutoReadBand.vue";
import { FOCUS_BAND_END } from "../captions/visibility";

describe("AutoReadBand", () => {
  it("draws one mark for each side of the strip", () => {
    const w = mount(AutoReadBand, { props: { bandEnd: FOCUS_BAND_END } });
    expect(w.findAll("[data-autoread-band] .autoread-band-mark")).toHaveLength(2);
  });

  it("publishes the band as a custom property so CSS owns the geometry", () => {
    const w = mount(AutoReadBand, { props: { bandEnd: 0.8 } });
    // Unitless: the stylesheet multiplies it by 100dvh, matching the
    // visualViewport height auto-read measures against.
    expect(w.attributes("style")).toContain("--autoread-band-end: 0.8");
  });

  it("is decoration — hidden from the accessibility tree and unclickable", () => {
    const w = mount(AutoReadBand, { props: { bandEnd: FOCUS_BAND_END } });
    expect(w.attributes("aria-hidden")).toBe("true");
    // The hit-test exclusion lives in reader-shared.css (pointer-events: none);
    // the marker must never own a hit area or it would eat page-turn clicks.
    expect(w.text()).toBe("");
  });
});
