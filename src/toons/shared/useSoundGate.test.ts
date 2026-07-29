import { describe, it, expect, vi, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useSoundGate } from "./useSoundGate";

function withSetup<T>(factory: () => T): T {
  let result!: T;
  const Comp = defineComponent({
    setup() {
      result = factory();
      return () => null;
    },
  });
  mount(Comp);
  return result;
}

describe("useSoundGate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts disabled and toggles", () => {
    const onChange = vi.fn();
    const g = withSetup(() => useSoundGate({ onChange }));

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
    const g = withSetup(() => useSoundGate());

    g.gate.onBlockedPlay?.();
    expect(g.promptVisible.value).toBe(true);

    g.dismissPrompt();
    expect(g.promptVisible.value).toBe(false);

    // Second blocked play does not re-open after dismiss
    g.gate.onBlockedPlay?.();
    expect(g.promptVisible.value).toBe(false);
  });

  it("enableFromPrompt turns sound on and closes dialog", () => {
    const g = withSetup(() => useSoundGate());
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

    const g = withSetup(() =>
      useSoundGate({ confirmSrc: "assets/sfx/beep.mp3" })
    );
    g.setEnabled(true);
    expect(window.Audio).toHaveBeenCalledWith("assets/sfx/beep.mp3");
    expect(play).toHaveBeenCalled();
  });
});
