<script setup lang="ts">
/**
 * One-shot dialog: browsers block caption autoplay until a click.
 * OK runs inside the user gesture so FlipFrame can unlock HTMLAudio (iOS needs
 * a real play() here — AudioContext alone is not enough) and auto-read without
 * a second tap on the art.
 */
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
  enable: [];
  dismiss: [];
}>();

function onClose(): void {
  emit("update:open", false);
  emit("dismiss");
}

function onEnable(): void {
  // Parent unlocks media in this click handler (gesture stack).
  emit("enable");
  emit("update:open", false);
}
</script>

<template>
  <TransitionRoot :show="open" as="template">
    <Dialog class="sound-prompt-dialog" as="div" @close="onClose">
      <TransitionChild
        as="template"
        enter="sound-prompt-enter"
        enter-from="sound-prompt-enter-from"
        enter-to="sound-prompt-enter-to"
        leave="sound-prompt-leave"
        leave-from="sound-prompt-leave-from"
        leave-to="sound-prompt-leave-to"
      >
        <div class="sound-prompt" @click.stop>
          <DialogPanel class="sound-prompt__panel">
            <svg
              class="sound-prompt__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              aria-hidden="true"
            >
              <path d="M11 5L6 9H3v6h3l5 4V5z" stroke-linejoin="round" stroke-linecap="round" />
              <path d="M15.5 8.5a5 5 0 010 7" stroke-linecap="round" />
              <path d="M18 6a8.5 8.5 0 010 12" stroke-linecap="round" />
            </svg>
            <DialogTitle as="h2">Captions play themselves</DialogTitle>
            <p>
              Browsers need one click before any page can make sound. Tap
              <strong>OK</strong> and FlipFrame will read glowing captions automatically as you turn pages — no need to
              tap each bubble.
            </p>
            <div class="sound-prompt__actions">
              <button type="button" class="sound-prompt__btn sound-prompt__btn--primary" @click="onEnable">
                OK — play captions
              </button>
              <button type="button" class="sound-prompt__btn" @click="onClose">Not now</button>
            </div>
          </DialogPanel>
        </div>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>
