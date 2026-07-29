<script setup lang="ts">
import { computed, ref } from "vue";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string | null;
    logo?: string | null;
    altPrefix?: string;
    soundHint?: string | null;
    soundEnabled?: boolean;
  }>(),
  {
    title: "",
    subtitle: "Experiment",
    logo: null,
    altPrefix: "Page",
    soundHint: null,
    soundEnabled: false,
  }
);

const emit = defineEmits<{
  soundToggle: [];
}>();

const aboutOpen = ref(false);

const soundTitle = computed(() => (props.soundEnabled ? "Mute sound" : "Enable sound"));
const soundLabel = computed(() => (props.soundEnabled ? "Sound on" : props.soundHint || "Sound"));
</script>

<template>
  <div class="front-cover-instructions">
    <h1 v-if="title" class="front-cover-title">{{ title }}</h1>
    <p v-if="subtitle" class="front-cover-subtitle">{{ subtitle }}</p>

    <div class="front-cover-brand">
      <p class="front-cover-brand-line">
        <span class="front-cover-brand-word">FlipFrame</span>
        <button
          type="button"
          class="front-cover-brand-info"
          title="About FlipFrame"
          aria-label="About FlipFrame"
          @click.stop="aboutOpen = true"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" stroke-linecap="round" />
            <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </p>
      <p class="front-cover-brand-by">by twentyseven.pictures</p>
    </div>

    <img v-if="logo" class="front-cover-logo" :src="logo" :alt="`${altPrefix} logo`" />
    <h2>How to read</h2>
    <ul>
      <li>Click or tap the right page<span>next page</span></li>
      <li>Click or tap the left page<span>previous page</span></li>
      <li>Use the arrow buttons below<span>← previous · → next</span></li>
      <li>Keyboard arrow keys<span>← previous · → next</span></li>
      <li>Swipe on touch devices<span>left = next · right = previous</span></li>
    </ul>

    <template v-if="soundHint">
      <button
        type="button"
        class="toon-fs-btn front-cover-sound-btn"
        :class="{ 'is-active': soundEnabled, 'is-enabled': soundEnabled }"
        :aria-pressed="soundEnabled"
        :title="soundTitle"
        :aria-label="soundTitle"
        @click.stop="emit('soundToggle')"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M4 9v6h4l5 4V5L8 9H4z" stroke-linecap="round" stroke-linejoin="round" />
          <path
            class="front-cover-sound-waves"
            d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span :data-off-label="soundHint">{{ soundLabel }}</span>
      </button>
      <p class="front-cover-sound-note">Hover (or tap) glowing captions on any page to hear them</p>
    </template>
  </div>

  <TransitionRoot :show="aboutOpen" as="template">
    <Dialog class="sound-prompt-dialog" as="div" @close="aboutOpen = false">
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
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" stroke-linecap="round" />
              <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
            </svg>
            <DialogTitle as="h2">FlipFrame beta</DialogTitle>
            <p>
              FlipFrame is a beta product by
              <strong>twentyseven.pictures</strong>. If you’d like to integrate this reader on your site, get in touch
              via our contact form.
            </p>
            <div class="sound-prompt__actions">
              <a href="/#contact" class="sound-prompt__btn sound-prompt__btn--primary" @click.stop> Contact us </a>
              <button type="button" class="sound-prompt__btn" @click.stop="aboutOpen = false">Close</button>
            </div>
          </DialogPanel>
        </div>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>
