<script setup lang="ts">
/**
 * Mobile / narrow: same CoverFirstPage as the book plate, in a modal shell
 * (toolbar-recallable). Dialog owns chrome only — close + start CTA.
 */
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";
import CoverFirstPage from "./CoverFirstPage.vue";

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
            <div class="cover-guide-toolbar">
              <button type="button" class="cover-guide-close" aria-label="Close" @click="close">×</button>
            </div>

            <div class="cover-guide-scroll">
              <CoverFirstPage variant="modal" :title="title" :subtitle="subtitle" :synopsis="synopsis">
                <template #title>
                  <DialogTitle as="h1" class="front-cover-title">
                    {{ title || "Story" }}
                  </DialogTitle>
                </template>
              </CoverFirstPage>
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
