import { describe, it, expect, vi, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useSoundGate } from "./useSoundGate";

function withSetup<T>(factory: () => T): { api: T; unmount: () => void } {
  let result!: T;
  const Comp = defineComponent({
    setup() {
      result = factory();
      return () => null;
    },
  });
  const wrapper = mount(Comp);
  return { api: result, unmount: () => wrapper.unmount() };
}

describe("useSoundGate", () => {
  afterEach(() => {
    document.body.className = "";
    vi.restoreAllMocks();
  });

  it("starts disabled and toggles", () => {
    const onChange = vi.fn();
    const { api: g } = withSetup(() => useSoundGate({ onChange }));

    expect(g.enabled.value).toBe(false);
    expect(g.gate.isEnabled()).toBe(false);

    g.toggle();
    expect(g.enabled.value).toBe(true);
    expect(g.gate.isEnabled()).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);

    g.toggle();
    expect(g.enabled.value).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("prompts once when SFX is blocked", () => {
    const { api: g } = withSetup(() => useSoundGate());

    g.gate.onBlockedPlay?.();
    expect(g.promptVisible.value).toBe(true);

    g.dismissPrompt();
    expect(g.promptVisible.value).toBe(false);

    // Second blocked play does not re-open after dismiss
    g.gate.onBlockedPlay?.();
    expect(g.promptVisible.value).toBe(false);
  });

  it("onEngage prompts once (desktop + mobile page-turn / scroll)", () => {
    const { api: g } = withSetup(() => useSoundGate({ promptOnScroll: false }));

    g.onEngage();
    expect(g.promptVisible.value).toBe(true);

    g.dismissPrompt();
    g.onEngage();
    expect(g.promptVisible.value).toBe(false);
  });

  it("does not prompt on engage when sound is already on", () => {
    const { api: g } = withSetup(() => useSoundGate({ promptOnScroll: false }));
    g.setEnabled(true);
    g.onEngage();
    expect(g.promptVisible.value).toBe(false);
  });

  it("shows prompt on first vertical scroll past threshold", () => {
    const { api: g } = withSetup(() => useSoundGate({ promptOnScroll: true }));
    document.body.classList.add("view-vertical");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    window.dispatchEvent(new Event("scroll"));
    expect(g.promptVisible.value).toBe(false);

    Object.defineProperty(window, "scrollY", { configurable: true, value: 48 });
    window.dispatchEvent(new Event("scroll"));
    expect(g.promptVisible.value).toBe(true);

    g.dismissPrompt();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    window.dispatchEvent(new Event("scroll"));
    expect(g.promptVisible.value).toBe(false);
  });

  it("ignores scroll when not in vertical view mode", () => {
    const { api: g } = withSetup(() => useSoundGate({ promptOnScroll: true }));
    Object.defineProperty(window, "scrollY", { configurable: true, value: 100 });
    window.dispatchEvent(new Event("scroll"));
    expect(g.promptVisible.value).toBe(false);
  });

  it("resets prompt gate when the composable remounts", () => {
    const first = withSetup(() => useSoundGate({ promptOnScroll: false }));
    first.api.onEngage();
    expect(first.api.promptVisible.value).toBe(true);
    first.api.dismissPrompt();
    first.unmount();

    const second = withSetup(() => useSoundGate({ promptOnScroll: false }));
    second.api.onEngage();
    expect(second.api.promptVisible.value).toBe(true);
    second.unmount();
  });

  it("enableFromPrompt turns sound on and closes dialog", () => {
    const { api: g } = withSetup(() => useSoundGate({ promptOnScroll: false }));
    g.maybePrompt();
    expect(g.promptVisible.value).toBe(true);

    g.enableFromPrompt();
    expect(g.enabled.value).toBe(true);
    expect(g.promptVisible.value).toBe(false);
  });

  it("plays confirm beep when confirmSrc is set", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "Audio").mockImplementation(function (
      this: HTMLAudioElement,
      src?: string
    ) {
      this.src = src || "";
      this.play = play;
      return this;
    } as unknown as typeof Audio);

    const { api: g } = withSetup(() =>
      useSoundGate({ confirmSrc: "assets/sfx/beep.mp3", promptOnScroll: false })
    );
    g.setEnabled(true);
    expect(window.Audio).toHaveBeenCalledWith("assets/sfx/beep.mp3");
    expect(play).toHaveBeenCalled();
  });
});
