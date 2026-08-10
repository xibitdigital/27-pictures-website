import { describe, it, expect, afterEach, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import WordLayer from "./WordLayer.vue";
import { AUTO_READ_KEY, createAutoReadController } from "./useAutoRead";
import type { WordEntry } from "../types";

/**
 * jsdom getBoundingClientRect is 0×0 — give plates a real on-screen box so
 * controller geometry visibility can mark them readable without setVisible.
 */
function stubViewportGeometry(): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 700,
      width: 400,
      height: 700,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

/** On-screen (or off-screen) rect for geometry-owned visibility. */
function makeRect(left = 0, on = true): DOMRect {
  if (!on) {
    return {
      top: 9000,
      left,
      right: left + 100,
      bottom: 9100,
      width: 100,
      height: 100,
      x: left,
      y: 9000,
      toJSON: () => ({}),
    } as DOMRect;
  }
  return {
    top: 0,
    left,
    right: left + 100,
    bottom: 100,
    width: 100,
    height: 100,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Mutable getRect so tests can show/hide without setVisible. */
function trackRect(left = 0) {
  const state = { on: true, left };
  return {
    state,
    getRect: () => makeRect(state.left, state.on),
    show(h: { layoutChanged: () => void }) {
      state.on = true;
      h.layoutChanged();
    },
    hide(h: { layoutChanged: () => void }) {
      state.on = false;
      h.layoutChanged();
    },
  };
}

function makeImage(): HTMLImageElement {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: 1008 });
  Object.defineProperty(img, "naturalHeight", { value: 1792 });
  Object.defineProperty(img, "clientWidth", { value: 504 });
  Object.defineProperty(img, "clientHeight", { value: 896 });
  Object.defineProperty(img, "complete", { value: true });
  document.body.appendChild(img);
  return img;
}

function mountLayer(words: WordEntry[], extra: Record<string, unknown> = {}) {
  return mount(WordLayer, {
    props: { pageNum: 1, words, imageEl: makeImage(), ...extra },
    attachTo: document.body,
  });
}

describe("WordLayer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders one caption per word, sized to the plate's content box", async () => {
    const wrapper = mountLayer([
      { x: 0.5, y: 0.2, size: 40, text: "HELLO" },
      { x: 0.3, y: 0.8, size: 30, variant: "ai", text: "WE ARE IN!" },
    ] as WordEntry[]);
    await nextTick();

    const captions = wrapper.findAll(".jax-word");
    expect(captions).toHaveLength(2);
    expect(captions[0].text()).toBe("HELLO");
    expect(captions[1].classes()).toContain("jax-word--ai");
    // AI/bubble variants carry their SVG chrome as a child component.
    expect(captions[1].find("svg.jax-bubble-svg").exists()).toBe(true);
    expect(wrapper.find(".jax-word-layer").attributes("style")).toContain("width: 504px");
  });

  it("plays a caption's SFX on click and does not let the click turn the page", async () => {
    const playSpy = vi.spyOn(window.HTMLAudioElement.prototype, "play").mockResolvedValue(undefined);
    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    const parentClick = vi.fn();

    const Host = defineComponent({
      setup() {
        return () =>
          h("div", { onClick: parentClick }, [
            h(WordLayer, {
              pageNum: 1,
              words: [{ x: 0.5, y: 0.5, text: "BOOM", audio: "sfx/x.mp3" }] as WordEntry[],
              imageEl: makeImage(),
            }),
          ]);
      },
    });

    const wrapper = mount(Host, {
      attachTo: document.body,
      global: { provide: { [AUTO_READ_KEY as symbol]: controller } },
    });
    await nextTick();

    await wrapper.find(".jax-word--sfx").trigger("click");
    expect(playSpy).toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
    controller.stop();
  });

  it("auto-reads the page top→bottom, highlighting the caption that is speaking", async () => {
    stubViewportGeometry();
    const played: string[] = [];
    const clips: HTMLAudioElement[] = [];
    // Clips stay open so the highlight can be inspected mid-playback.
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      const file = (this.src || "").split("/").pop() || "";
      if (file === "t.mp3" || file === "b.mp3") {
        played.push(file);
        clips.push(this);
      }
      return Promise.resolve();
    });
    const speaking = (): string =>
      wrapper
        .findAll(".jax-word.is-speaking")
        .map((w) => w.text())
        .join("|");

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    const wrapper = mount(WordLayer, {
      props: {
        pageNum: 1,
        // Deliberately out of reading order in the config.
        words: [
          { x: 0.5, y: 0.8, text: "BOTTOM", audio: "sfx/b.mp3" },
          { x: 0.5, y: 0.2, text: "TOP", audio: "sfx/t.mp3" },
        ] as WordEntry[],
        imageEl: makeImage(),
      },
      attachTo: document.body,
      global: { provide: { [AUTO_READ_KEY as symbol]: controller } },
    });

    // Top caption first, highlighted while its clip runs.
    await vi.waitFor(() => expect(played).toEqual(["t.mp3"]), { timeout: 3000 });
    await nextTick();
    expect(speaking()).toBe("TOP");

    clips[0].dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(played).toEqual(["t.mp3", "b.mp3"]), { timeout: 3000 });
    await nextTick();
    expect(speaking()).toBe("BOTTOM");

    clips[1].dispatchEvent(new Event("ended"));
    await vi.waitFor(async () => {
      await nextTick();
      expect(speaking()).toBe("");
    });
    controller.stop();
  });

  it("reads a book spread left page top→bottom, then the right page", async () => {
    stubViewportGeometry();
    const played: string[] = [];
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      played.push(this.src.split("/").pop() || "");
      setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
      return Promise.resolve();
    });
    // Layers report their slot's x offset so the spread has a real left/right.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const left = Number((this.closest("[data-slot-left]") as HTMLElement | null)?.dataset.slotLeft || 0);
      return {
        top: 0,
        left,
        right: left + 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: left,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    const Spread = defineComponent({
      setup() {
        // Right half is rendered first — position decides, not mount order.
        return () =>
          h("div", [
            h("div", { "data-slot-left": "500" }, [
              h(WordLayer, {
                pageNum: 2,
                words: [{ x: 0.5, y: 0.4, text: "R", audio: "sfx/r1.mp3" }] as WordEntry[],
                imageEl: makeImage(),
              }),
            ]),
            h("div", { "data-slot-left": "0" }, [
              h(WordLayer, {
                pageNum: 1,
                words: [
                  { x: 0.5, y: 0.2, text: "L1", audio: "sfx/l1.mp3" },
                  { x: 0.5, y: 0.8, text: "L2", audio: "sfx/l2.mp3" },
                ] as WordEntry[],
                imageEl: makeImage(),
              }),
            ]),
          ]);
      },
    });

    mount(Spread, {
      attachTo: document.body,
      global: { provide: { [AUTO_READ_KEY as symbol]: controller } },
    });
    await flushPromises();

    await vi.waitFor(() => expect(played.length).toBe(3), { timeout: 3000 });
    expect(played).toEqual(["l1.mp3", "l2.mp3", "r1.mp3"]);
  });

  it("keeps reading when the flip drops the layer below the visibility threshold", async () => {
    const played: string[] = [];
    const clips: HTMLAudioElement[] = [];
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      played.push(this.src.split("/").pop() || "");
      clips.push(this);
      return Promise.resolve();
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    const track = trackRect(0);
    const clip = (id: string, index: number) => ({ index, audio: `sfx/${id}.mp3`, volume: 1, x: 0.5, y: 0.2 + index });

    const l = controller.registerLayer({ id: "10", getRect: track.getRect });
    l.setCaptions([clip("a", 0), clip("b", 1), clip("c", 2)]);

    await vi.waitFor(() => expect(played).toEqual(["a.mp3"]), { timeout: 3000 });

    // The leaf sweeps across: the layer stops intersecting while the first clip
    // finishes, and is still below threshold when the loop comes back around.
    track.hide(l);
    clips[0].dispatchEvent(new Event("ended"));
    await new Promise((r) => setTimeout(r, 50));
    track.show(l);

    // The rest of the page still gets read — a dip is not an unmount.
    await vi.waitFor(() => expect(played).toEqual(["a.mp3", "b.mp3"]), { timeout: 3000 });
    clips[1].dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(played).toEqual(["a.mp3", "b.mp3", "c.mp3"]), { timeout: 3000 });
  });

  it("keeps reading after the flip leaf unmounts (same page remounts on the slot)", async () => {
    // Regression: first SFX played, then silence — the leaf's WordLayer released
    // mid-sequence, stop()'d audio, and coverage blocked the settled slot from
    // restarting the rest of the page.
    const played: string[] = [];
    const clips: HTMLAudioElement[] = [];
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      played.push(this.src.split("/").pop() || "");
      clips.push(this);
      return Promise.resolve();
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    const clip = (id: string, index: number) => ({ index, audio: `sfx/${id}.mp3`, volume: 1, x: 0.5, y: 0.2 + index });
    const captions = [clip("a", 0), clip("b", 1), clip("c", 2)];

    // Leaf mounts first (only thing on screen during the flip).
    const leaf = controller.registerLayer({ id: "12", getRect: () => makeRect(0) });
    leaf.setCaptions(captions);

    await vi.waitFor(() => expect(played).toEqual(["a.mp3"]), { timeout: 3000 });

    // Flip settles: slot mounts under the leaf, then the leaf unmounts.
    const slot = controller.registerLayer({ id: "12", getRect: () => makeRect(0) });
    slot.setCaptions(captions);
    leaf.release();

    clips[0].dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(played).toEqual(["a.mp3", "b.mp3"]), { timeout: 3000 });
    clips[1].dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(played).toEqual(["a.mp3", "b.mp3", "c.mp3"]), { timeout: 3000 });
  });

  it("appends the right half when it arrives after the left is already speaking", async () => {
    const played: string[] = [];
    const clips: HTMLAudioElement[] = [];
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      played.push(this.src.split("/").pop() || "");
      clips.push(this);
      return Promise.resolve();
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    const clip = (id: string, index: number) => ({ index, audio: `sfx/${id}.mp3`, volume: 1, x: 0.5, y: 0.2 + index });

    const left = controller.registerLayer({ id: "20", getRect: () => makeRect(0) });
    left.setCaptions([clip("l1", 0), clip("l2", 1)]);

    await vi.waitFor(() => expect(played).toEqual(["l1.mp3"]), { timeout: 3000 });

    // Right page of the spread mounts a beat later (book settle).
    const right = controller.registerLayer({ id: "21", getRect: () => makeRect(500) });
    right.setCaptions([clip("r1", 0)]);
    await new Promise((r) => setTimeout(r, 250));

    // Left page must finish — not be aborted so only the right half plays.
    clips[0].dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(played).toEqual(["l1.mp3", "l2.mp3"]), { timeout: 3000 });
    clips[1].dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(played).toEqual(["l1.mp3", "l2.mp3", "r1.mp3"]), { timeout: 3000 });
  });

  it("retries the whole view after autoplay blocks the first clip", async () => {
    const played: string[] = [];
    let blocked = true;
    // Stub AudioContext so unlock runs the same path as production (gesture → resume → restart).
    class FakeAC {
      state = "suspended";
      resume() {
        this.state = "running";
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
      createBuffer() {
        return { length: 1 };
      }
      createBufferSource() {
        return {
          buffer: null as unknown,
          connect() {},
          start() {},
        };
      }
      destination = {};
    }
    vi.stubGlobal("AudioContext", FakeAC);

    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      // Silent unlock WAV must succeed during the gesture even while real clips are blocked.
      const src = this.src || "";
      if (src.startsWith("data:audio/wav")) return Promise.resolve();
      // Browsers reject play() until the page has seen a user gesture.
      if (blocked) return Promise.reject(new Error("NotAllowedError"));
      const file = src.split("/").pop() || "";
      // Only track this test's clips — other tests' async Audio may still fire.
      if (file === "a.mp3" || file === "b.mp3") {
        played.push(file);
        setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
      }
      return Promise.resolve();
    });

    // Production default: wait for a gesture (OK prompt / page turn).
    const controller = createAutoReadController({ gapMs: 0, requireGesture: true });
    const clip = (id: string, index: number) => ({ index, audio: `sfx/${id}.mp3`, volume: 1, x: 0.5, y: 0.2 + index });

    const l1 = controller.registerLayer({ id: "1", getRect: () => makeRect(0) });
    l1.setCaptions([clip("a", 0), clip("b", 1)]);

    await new Promise((r) => setTimeout(r, 400));
    // Gated — no clips until unlock.
    expect(played).toEqual([]);
    expect(controller.promptOpen.value).toBe(true);

    blocked = false;
    // OK / first interaction: HTMLAudio silent prime + restart auto-read.
    controller.enableFromPrompt();

    await vi.waitFor(
      () => {
        expect(played.filter((p) => p === "a.mp3").length).toBeGreaterThanOrEqual(1);
        expect(played.filter((p) => p === "b.mp3").length).toBeGreaterThanOrEqual(1);
        expect(played.indexOf("a.mp3")).toBeLessThan(played.lastIndexOf("b.mp3"));
      },
      { timeout: 3000 }
    );
    controller.stop();
  });

  it("bubble tap unlocks auto-read for later async clips (iOS gesture path)", async () => {
    const played: string[] = [];
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      const src = this.src || "";
      if (src.startsWith("data:audio/wav")) return Promise.resolve();
      const file = src.split("/").pop() || "";
      if (file === "tap.mp3" || file === "next.mp3") {
        played.push(file);
        setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
      }
      return Promise.resolve();
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: true });
    const layer = controller.registerLayer({ id: "1", getRect: () => makeRect(0) });
    layer.setCaptions([
      { index: 0, audio: "sfx/tap.mp3", volume: 1, x: 0.5, y: 0.2 },
      { index: 1, audio: "sfx/next.mp3", volume: 1, x: 0.5, y: 0.8 },
    ]);

    await new Promise((r) => setTimeout(r, 300));
    expect(played).toEqual([]);
    expect(controller.unlocked.value).toBe(false);

    // User taps a bubble — unlock + play that clip inside the gesture.
    layer.playOne({ index: 0, audio: "sfx/tap.mp3", volume: 1, x: 0.5, y: 0.2 });
    await vi.waitFor(() => expect(played).toContain("tap.mp3"), { timeout: 2000 });
    expect(controller.unlocked.value).toBe(true);
    controller.stop();
  });

  it("hard-cuts on rapid page swaps instead of stacking every intermediate page", async () => {
    // Regression: flipping 1→2→3 quickly used to append each new page onto the
    // still-running queue, so clips from pages the user already left kept playing.
    const played: string[] = [];
    const clips: HTMLAudioElement[] = [];
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      played.push(this.src.split("/").pop() || "");
      clips.push(this);
      return Promise.resolve();
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    const clip = (id: string, index: number) => ({ index, audio: `sfx/${id}.mp3`, volume: 1, x: 0.5, y: 0.2 + index });
    const t1 = trackRect(0);
    const t2 = trackRect(0);
    const t3 = trackRect(0);

    const p1 = controller.registerLayer({ id: "1", getRect: t1.getRect });
    p1.setCaptions([clip("p1a", 0), clip("p1b", 1), clip("p1c", 2)]);

    await vi.waitFor(() => expect(played).toEqual(["p1a.mp3"]), { timeout: 3000 });

    // Rapid skip: page 1 still on screen for a beat while 2 and 3 flash through.
    const p2 = controller.registerLayer({ id: "2", getRect: t2.getRect });
    p2.setCaptions([clip("p2a", 0)]);
    await new Promise((r) => setTimeout(r, 50)); // before settle
    t1.hide(p1);
    t2.hide(p2);
    p2.release();
    const p3 = controller.registerLayer({ id: "3", getRect: t3.getRect });
    p3.setCaptions([clip("p3a", 0), clip("p3b", 1)]);
    p1.release();

    // Settle + first clip of the final page only.
    await vi.waitFor(() => expect(played).toContain("p3a.mp3"), { timeout: 3000 });
    // Page 1 must not keep speaking after the skip; page 2 was only a flash.
    expect(played.filter((s) => s.startsWith("p1")).length).toBe(1); // only the first clip before the cut
    expect(played).not.toContain("p1b.mp3");
    expect(played).not.toContain("p1c.mp3");
    expect(played).not.toContain("p2a.mp3");

    const p3Start = played.indexOf("p3a.mp3");
    clips[p3Start].dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(played).toContain("p3b.mp3"), { timeout: 3000 });
    expect(played.slice(p3Start)).toEqual(["p3a.mp3", "p3b.mp3"]);
  });

  it("does not restart the spread when a page turn tears it down one half at a time", async () => {
    const played: string[] = [];
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      played.push(this.src.split("/").pop() || "");
      setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
      return Promise.resolve();
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    const clip = (id: string, index: number) => ({ index, audio: `sfx/${id}.mp3`, volume: 1, x: 0.5, y: 0.2 + index });

    const l8 = controller.registerLayer({ id: "8", getRect: () => makeRect(0) });
    const l9 = controller.registerLayer({ id: "9", getRect: () => makeRect(500) });
    l8.setCaptions([clip("p8a", 0), clip("p8b", 1)]);
    l9.setCaptions([clip("p9a", 0)]);

    await vi.waitFor(() => expect(played).toEqual(["p8a.mp3", "p8b.mp3", "p9a.mp3"]), { timeout: 3000 });

    // The turn: 9 unmounts first, leaving 8 alone for a beat, then the incoming
    // spread mounts while 8 is still on its way out.
    l9.release();
    await new Promise((r) => setTimeout(r, 250));
    const l10 = controller.registerLayer({ id: "10", getRect: () => makeRect(0) });
    const l11 = controller.registerLayer({ id: "11", getRect: () => makeRect(500) });
    l10.setCaptions([clip("p10a", 0)]);
    l11.setCaptions([clip("p11a", 0)]);
    await new Promise((r) => setTimeout(r, 250));
    l8.release();

    await vi.waitFor(() => expect(played).toContain("p10a.mp3"), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 300));
    // Page 8 is never read a second time, and the new spread does get read.
    // Filter to this test's clips — other suites may still have in-flight Audio.
    const mine = played.filter((p) => /^p(8|9|10|11)/.test(p));
    expect(mine).toEqual(["p8a.mp3", "p8b.mp3", "p9a.mp3", "p10a.mp3", "p11a.mp3"]);
  });

  it("reads a page once when it is mounted twice (flip leaf over its slot)", async () => {
    stubViewportGeometry();
    const played: string[] = [];
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      const file = (this.src || "").split("/").pop() || "";
      // Ignore silent-unlock WAV and other suites' in-flight clips.
      if (file === "once-a.mp3" || file === "once-b.mp3") {
        played.push(file);
        setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
      }
      return Promise.resolve();
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    const words = [
      { x: 0.5, y: 0.2, text: "A", audio: "sfx/once-a.mp3" },
      { x: 0.5, y: 0.8, text: "B", audio: "sfx/once-b.mp3" },
    ] as WordEntry[];
    // A flipping leaf carries the same page as the slot it covers. Without
    // dedup the key goes "3" → "3|3", which restarts the sequence, and the
    // page reads twice over.
    const Flipping = defineComponent({
      setup() {
        return () =>
          h("div", [
            h(WordLayer, { pageNum: 3, words, imageEl: makeImage() }),
            h(WordLayer, { pageNum: 3, words, imageEl: makeImage() }),
          ]);
      },
    });

    mount(Flipping, {
      attachTo: document.body,
      global: { provide: { [AUTO_READ_KEY as symbol]: controller } },
    });
    await flushPromises();

    await vi.waitFor(() => expect(played.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    // Settle well past the gap so a duplicate pass would have shown up.
    await new Promise((r) => setTimeout(r, 250));
    expect(played).toEqual(["once-a.mp3", "once-b.mp3"]);
    controller.stop();
  });

  it("pauses auto-read during scroll and resumes after idle (mobile fling path)", async () => {
    stubViewportGeometry();
    const played: string[] = [];
    let autoEnd = false;
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      const file = (this.src || "").split("/").pop() || "";
      if (file === "scroll-a.mp3" || file === "scroll-b.mp3") {
        played.push(file);
        if (autoEnd) setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
      }
      return Promise.resolve();
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    mount(WordLayer, {
      props: {
        pageNum: 1,
        words: [
          { x: 0.5, y: 0.2, text: "A", audio: "sfx/scroll-a.mp3" },
          { x: 0.5, y: 0.8, text: "B", audio: "sfx/scroll-b.mp3" },
        ] as WordEntry[],
        imageEl: makeImage(),
      },
      attachTo: document.body,
      global: { provide: { [AUTO_READ_KEY as symbol]: controller } },
    });

    // First clip starts and stays open (mid-speak).
    await vi.waitFor(() => expect(played).toEqual(["scroll-a.mp3"]), { timeout: 3000 });

    // Rapid fling ticks: only the first should hard-cut; rest must stay cheap.
    controller.notifyScroll();
    controller.notifyScroll();
    controller.notifyScroll();
    await new Promise((r) => setTimeout(r, 300));
    expect(played).toEqual(["scroll-a.mp3"]);

    // After scroll idle (~700ms) + settle, resume from the settled plate.
    autoEnd = true;
    await vi.waitFor(() => expect(played.filter((p) => p === "scroll-a.mp3").length).toBeGreaterThanOrEqual(2), {
      timeout: 4000,
    });
    controller.stop();
  });

  it("starts auto-read after unlock without requiring a scroll (geometry visibility)", async () => {
    // Layer supplies on-screen getRect but never setVisible — unlock + geometry
    // must start reading (controller owns visibility).
    const played: string[] = [];
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      const file = (this.src || "").split("/").pop() || "";
      if (file === "noscroll-a.mp3") {
        played.push(file);
        setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
      }
      return Promise.resolve();
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: true });
    const onScreen: DOMRect = {
      x: 0,
      y: 40,
      top: 40,
      left: 0,
      right: 300,
      bottom: 500,
      width: 300,
      height: 460,
      toJSON: () => ({}),
    } as DOMRect;

    const layer = controller.registerLayer({ id: "1", getRect: () => onScreen });
    layer.setCaptions([{ index: 0, audio: "sfx/noscroll-a.mp3", volume: 1, x: 0.5, y: 0.2 }]);

    controller.enableFromPrompt();
    await vi.waitFor(() => expect(played).toContain("noscroll-a.mp3"), { timeout: 3000 });
    controller.stop();
  });

  it("does not spin infinite retries when play() keeps failing after a fling", async () => {
    stubViewportGeometry();
    let playCalls = 0;
    vi.spyOn(window.HTMLAudioElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      playCalls++;
      return Promise.reject(new Error("NotAllowedError"));
    });

    const controller = createAutoReadController({ gapMs: 0, requireGesture: false });
    mount(WordLayer, {
      props: {
        pageNum: 1,
        words: [{ x: 0.5, y: 0.2, text: "A", audio: "sfx/fail-a.mp3" }] as WordEntry[],
        imageEl: makeImage(),
      },
      attachTo: document.body,
      global: { provide: { [AUTO_READ_KEY as symbol]: controller } },
    });

    // Let initial attempt + bounded retries settle (backoff 400 + 800ms).
    await new Promise((r) => setTimeout(r, 2500));
    // Without the cap this spun unbounded (thousands of play()s) and crashed the tab.
    expect(playCalls).toBeGreaterThan(0);
    expect(playCalls).toBeLessThan(20);
    controller.stop();
  });
});
