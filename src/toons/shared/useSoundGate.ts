/**
 * Caption SFX enable/prompt state — injectable into WordOverlay (no window globals).
 */
import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { SoundGate } from "./types";

export interface UseSoundGateOptions {
  /** Optional confirmation beep when enabling. */
  confirmSrc?: string;
  /** Called after enable state changes (e.g. re-paint front-cover control). */
  onChange?: (enabled: boolean) => void;
}

export interface UseSoundGateApi {
  enabled: Ref<boolean>;
  promptVisible: Ref<boolean>;
  title: ComputedRef<string>;
  label: ComputedRef<string>;
  setEnabled: (on: boolean) => void;
  toggle: () => void;
  maybePrompt: () => void;
  dismissPrompt: () => void;
  enableFromPrompt: () => void;
  /** Pass into `new WordOverlay(config, { sound: gate })`. */
  gate: SoundGate;
}

export function useSoundGate(opts: UseSoundGateOptions = {}): UseSoundGateApi {
  const enabled = ref(false);
  const promptVisible = ref(false);
  let promptShown = false;

  const title = computed(() =>
    enabled.value ? "Mute sound" : "Enable sound effects"
  );
  const label = computed(() => (enabled.value ? "Sound on" : "Sound"));

  function setEnabled(on: boolean): void {
    enabled.value = on;
    if (on) {
      if (opts.confirmSrc) {
        const confirm = new Audio(opts.confirmSrc);
        confirm.play().catch(() => {});
      }
      promptVisible.value = false;
      promptShown = true;
    }
    opts.onChange?.(on);
  }

  function maybePrompt(): void {
    if (enabled.value) return;
    if (promptShown) return;
    promptShown = true;
    promptVisible.value = true;
  }

  function dismissPrompt(): void {
    promptShown = true;
    promptVisible.value = false;
  }

  function enableFromPrompt(): void {
    setEnabled(true);
  }

  const gate: SoundGate = {
    isEnabled: () => enabled.value,
    onBlockedPlay: maybePrompt,
  };

  return {
    enabled,
    promptVisible,
    title,
    label,
    setEnabled,
    toggle: () => setEnabled(!enabled.value),
    maybePrompt,
    dismissPrompt,
    enableFromPrompt,
    gate,
  };
}
