/**
 * Caption SFX enable/prompt state — injectable into WordOverlay (no window globals).
 *
 * Prompt is shown at most once per composable instance (resets when the reader
 * remounts). Triggers: blocked caption SFX, first page turn, or first vertical
 * scroll (desktop and mobile).
 */
import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from "vue";
import type { SoundGate } from "../types";

/** Ignore tiny scroll noise / programmatic reset-to-top. */
const SCROLL_ENGAGE_PX = 32;

export interface UseSoundGateOptions {
  /** Optional confirmation beep when enabling. */
  confirmSrc?: string;
  /** Called after enable state changes (e.g. re-paint front-cover control). */
  onChange?: (enabled: boolean) => void;
  /**
   * When true, listen for vertical-mode window scroll and show the prompt on
   * first meaningful scroll. Default true.
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
  /** First scroll / page-turn engagement (same once-per-mount gate as maybePrompt). */
  onEngage: () => void;
  dismissPrompt: () => void;
  enableFromPrompt: () => void;
  /** Pass into `new WordOverlay(config, { sound: gate })`. */
  gate: SoundGate;
}

export function useSoundGate(opts: UseSoundGateOptions = {}): UseSoundGateApi {
  const enabled = ref(false);
  const promptVisible = ref(false);
  /** Session flag — always false on mount; never persisted. */
  let promptShown = false;

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

  /** Alias for engage hooks (page turn / scroll) — same once-per-mount gate. */
  function onEngage(): void {
    maybePrompt();
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

  function onScroll(): void {
    if (!document.body.classList.contains("view-vertical")) return;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y < SCROLL_ENGAGE_PX) return;
    onEngage();
  }

  if (opts.promptOnScroll !== false) {
    onMounted(() => {
      window.addEventListener("scroll", onScroll, { passive: true });
    });
    onBeforeUnmount(() => {
      window.removeEventListener("scroll", onScroll);
    });
  }

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
