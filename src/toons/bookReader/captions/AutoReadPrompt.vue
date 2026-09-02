<script setup lang="ts">
/**
 * One-shot dialog: browsers block caption autoplay until a click.
 * OK runs inside the user gesture so FlipFrame can unlock HTMLAudio (iOS needs
 * a real play() here — AudioContext alone is not enough) and auto-read without
 * a second tap on the art.
 */
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";
import { Volume2 } from "@lucide/vue";
import { useFlipframeCopy } from "../flipframeCopy";

const t = useFlipframeCopy();

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
            <Volume2 class="sound-prompt__icon" :stroke-width="1.75" aria-hidden="true" />
            <DialogTitle as="h2">{{ t.autoReadTitle }}</DialogTitle>
            <p>{{ t.autoReadBody }}</p>
            <div class="sound-prompt__actions">
              <button type="button" class="sound-prompt__btn sound-prompt__btn--primary" @click="onEnable">
                {{ t.autoReadOk }}
              </button>
              <button type="button" class="sound-prompt__btn" @click="onClose">{{ t.autoReadLater }}</button>
            </div>
          </DialogPanel>
        </div>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>
