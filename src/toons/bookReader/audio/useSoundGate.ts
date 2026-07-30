/**
 * Caption SFX enable/prompt state — injectable into WordOverlay (no window globals).
 *
 * Caption bubble tap while sound is off → show enable popup.
 * Page turn / scroll do not prompt (only explicit sound control or caption taps).
 */
import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { SoundGate } from "../types";

export interface UseSoundGateOptions {
  /** Optional confirmation beep when enabling. */
  confirmSrc?: string;
  /** Called after enable state changes (e.g. re-paint front-cover control). */
  onChange?: (enabled: boolean) => void;
  /**
   * @deprecated Scroll no longer prompts for sound. Kept for call-site compatibility.
   */
  promptOnScroll?: boolean;
}

export interface UseSoundGateApi {
  enabled: Ref<boolean>;
  promptVisible: Ref<boolean>;
  title: ComputedRef<string>;
  label: ComputedRef<string>;
  setEnabled: (on: boolean) => void;
  toggle: () => void;
  maybePrompt: () => void;
  /** No-op — page turn / scroll no longer engage the sound prompt. */
  onEngage: () => void;
  dismissPrompt: () => void;
  enableFromPrompt: () => void;
  /** Pass into `new WordOverlay(config, { sound: gate })`. */
  gate: SoundGate;
}

export function useSoundGate(opts: UseSoundGateOptions = {}): UseSoundGateApi {
  const enabled = ref(false);
  const promptVisible = ref(false);

  const title = computed(() => (enabled.value ? "Mute sound" : "Enable sound effects"));
  const label = computed(() => (enabled.value ? "Sound on" : "Sound"));

  function setEnabled(on: boolean): void {
    enabled.value = on;
    if (on) {
      if (opts.confirmSrc) {
        const confirm = new Audio(opts.confirmSrc);
        confirm.play().catch(() => {});
      }
      promptVisible.value = false;
    }
    opts.onChange?.(on);
  }

  /** @deprecated Prefer caption taps / sound button. No-op for passive engage. */
  function maybePrompt(): void {
    /* page turn / scroll no longer open the prompt */
  }

  /**
   * Caption bubble tap while muted: surface the enable popup
   * (unless already open or sound is on).
   */
  function promptOnBlockedPlay(): void {
    if (enabled.value) return;
    promptVisible.value = true;
  }

  function onEngage(): void {
    /* intentional no-op */
  }

  function dismissPrompt(): void {
    promptVisible.value = false;
  }

  function enableFromPrompt(): void {
    setEnabled(true);
  }

  const gate: SoundGate = {
    isEnabled: () => enabled.value,
    onBlockedPlay: promptOnBlockedPlay,
  };

  return {
    enabled,
    promptVisible,
    title,
    label,
    setEnabled,
    toggle: () => setEnabled(!enabled.value),
    maybePrompt,
    onEngage,
    dismissPrompt,
    enableFromPrompt,
    gate,
  };
}
