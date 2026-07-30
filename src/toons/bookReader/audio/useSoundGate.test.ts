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

  it("shows enable popup when caption is tapped while sound is off", () => {
    const { api: g } = withSetup(() => useSoundGate());

    expect(g.enabled.value).toBe(false);
    g.gate.onBlockedPlay?.();
    expect(g.promptVisible.value).toBe(true);
    expect(g.enabled.value).toBe(false);

    g.dismissPrompt();
    expect(g.promptVisible.value).toBe(false);

    // Bubble tap while still muted opens the popup again
    g.gate.onBlockedPlay?.();
    expect(g.promptVisible.value).toBe(true);

    g.enableFromPrompt();
    expect(g.enabled.value).toBe(true);
    expect(g.promptVisible.value).toBe(false);

    // Sound on → no popup
    g.gate.onBlockedPlay?.();
    expect(g.promptVisible.value).toBe(false);
  });

  it("onEngage does not open the sound prompt", () => {
    const { api: g } = withSetup(() => useSoundGate());

    g.onEngage();
    expect(g.promptVisible.value).toBe(false);

    g.maybePrompt();
    expect(g.promptVisible.value).toBe(false);
  });

  it("enableFromPrompt turns sound on and closes dialog", () => {
    const { api: g } = withSetup(() => useSoundGate());
    g.gate.onBlockedPlay?.();
    expect(g.promptVisible.value).toBe(true);

    g.enableFromPrompt();
    expect(g.enabled.value).toBe(true);
    expect(g.promptVisible.value).toBe(false);
  });

  it("plays confirm beep when confirmSrc is set", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "Audio").mockImplementation(function (this: HTMLAudioElement, src?: string) {
      this.src = src || "";
      this.play = play;
      return this;
    } as unknown as typeof Audio);

    const { api: g } = withSetup(() => useSoundGate({ confirmSrc: "assets/sfx/beep.mp3" }));
    g.setEnabled(true);
    expect(window.Audio).toHaveBeenCalledWith("assets/sfx/beep.mp3");
    expect(play).toHaveBeenCalled();
  });
});
