<script setup lang="ts">
/**
 * Mobile / narrow: story + short how-to as a clean modal (toolbar-recallable).
 * Own markup — does not reuse the absolute-fill book-cover layout.
 */
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";

defineProps<{
  open: boolean;
  title?: string;
  subtitle?: string | null;
  synopsis?: string | null;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
}>();

function close(): void {
  emit("update:open", false);
}
</script>

<template>
  <TransitionRoot :show="open" as="template">
    <Dialog class="cover-guide-dialog" as="div" @close="close">
      <TransitionChild
        as="template"
        enter="cover-guide-enter"
        enter-from="cover-guide-enter-from"
        enter-to="cover-guide-enter-to"
        leave="cover-guide-leave"
        leave-from="cover-guide-leave-from"
        leave-to="cover-guide-leave-to"
      >
        <div class="cover-guide-backdrop" aria-hidden="true" />
      </TransitionChild>

      <div class="cover-guide-center">
        <TransitionChild
          as="template"
          enter="cover-guide-enter"
          enter-from="cover-guide-panel-enter-from"
          enter-to="cover-guide-enter-to"
          leave="cover-guide-leave"
          leave-from="cover-guide-leave-from"
          leave-to="cover-guide-panel-leave-to"
        >
          <DialogPanel class="cover-guide-panel">
            <header class="cover-guide-header">
              <div class="cover-guide-header-text">
                <DialogTitle as="h1" class="cover-guide-title">{{ title || "Story" }}</DialogTitle>
                <p v-if="subtitle" class="cover-guide-subtitle">{{ subtitle }}</p>
              </div>
              <button type="button" class="cover-guide-close" aria-label="Close" @click="close">×</button>
            </header>

            <div class="cover-guide-scroll">
              <section v-if="synopsis" class="cover-guide-story" aria-label="The story">
                <h2 class="cover-guide-section-label">The story</h2>
                <p class="cover-guide-synopsis">{{ synopsis }}</p>
              </section>

              <section class="cover-guide-howto" aria-label="How to read">
                <h2 class="cover-guide-section-label">How to read</h2>
                <ul>
                  <li>Tap right · next page</li>
                  <li>Tap left · previous page</li>
                  <li>Arrows or swipe to turn</li>
                  <li>Tap glowing captions for audio</li>
                </ul>
              </section>
            </div>

            <footer class="cover-guide-footer">
              <button type="button" class="cover-guide-cta" @click="close">Start reading</button>
            </footer>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
