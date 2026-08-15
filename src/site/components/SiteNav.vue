<script setup lang="ts">
/** Main site chrome (fixed header + mobile menu). */
import { computed, ref, watch } from "vue";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";

const props = withDefaults(
  defineProps<{
    page?: "home" | "toons" | "cosplay" | "horror-shorts" | "watch";
  }>(),
  { page: "home" }
);

const menuOpen = ref(false);

/** Away from the homepage, section anchors must point back at it. */
const section = (hash: string) => (props.page === "home" ? hash : `/${hash}`);

const links = computed(() => [
  { href: "/horror-shorts/", label: "The Darkroom", current: props.page === "horror-shorts" },
  { href: "/watch/", label: "Watch", current: props.page === "watch" },
  { href: "/toons/", label: "Toons", current: props.page === "toons" },
  { href: "/cosplay/", label: "Cosplay", current: props.page === "cosplay" },
  { href: section("#contact"), label: "Contact" },
]);

watch(menuOpen, (open) => {
  document.body.style.overflow = open ? "hidden" : "";
});

function closeMenu(): void {
  menuOpen.value = false;
}
</script>

<template>
  <header>
    <nav role="navigation" aria-label="Main navigation">
      <a v-magnetic href="/" class="magnetic" aria-label="27 Pictures - Return to homepage">
        <img
          src="/logo.png"
          class="nav-logo-img"
          alt="27 Pictures"
          title="27 Pictures - Horror Film Production Studio"
          height="40"
        />
      </a>

      <button
        type="button"
        class="burger-btn"
        :class="{ active: menuOpen }"
        aria-label="Toggle navigation menu"
        :aria-expanded="menuOpen"
        aria-controls="mobileMenu"
        @click="menuOpen = !menuOpen"
      >
        <span class="burger-line" aria-hidden="true" />
        <span class="burger-line" aria-hidden="true" />
        <span class="burger-line" aria-hidden="true" />
      </button>

      <div class="nav-links" role="menubar">
        <a
          v-for="link in links"
          :key="link.href + link.label"
          v-magnetic
          class="magnetic"
          :href="link.href"
          role="menuitem"
          :aria-current="link.current ? 'page' : undefined"
        >
          {{ link.label }}
        </a>
        <a
          href="https://www.instagram.com/27pictures_production"
          class="nav-social-link"
          aria-label="Instagram"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <circle cx="12" cy="12" r="4.5" />
            <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
          </svg>
        </a>
        <a
          href="https://www.youtube.com/@twentyseven.pictures"
          class="nav-social-link"
          aria-label="YouTube"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"
            />
            <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none" />
          </svg>
        </a>
      </div>
    </nav>
  </header>

  <TransitionRoot :show="menuOpen" as="template">
    <Dialog id="mobileMenu" class="mobile-menu-dialog" as="div" @close="closeMenu">
      <TransitionChild
        as="template"
        enter="mobile-menu-enter"
        enter-from="mobile-menu-enter-from"
        enter-to="mobile-menu-enter-to"
        leave="mobile-menu-leave"
        leave-from="mobile-menu-leave-from"
        leave-to="mobile-menu-leave-to"
      >
        <div class="mobile-menu active" aria-label="Mobile navigation menu">
          <DialogPanel class="mobile-menu-panel">
            <DialogTitle class="sr-only">Navigation</DialogTitle>
            <a
              v-for="link in links"
              :key="'m-' + link.href + link.label"
              :href="link.href"
              class="mobile-menu-link"
              :aria-current="link.current ? 'page' : undefined"
              @click="closeMenu"
            >
              {{ link.label }}
            </a>
          </DialogPanel>
        </div>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>

<style scoped>
.mobile-menu-dialog {
  position: relative;
  z-index: 1001;
}

.mobile-menu-panel {
  display: contents;
}

.mobile-menu-enter,
.mobile-menu-leave {
  transition: opacity 0.2s ease;
}
.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
}
.mobile-menu-enter-to,
.mobile-menu-leave-from {
  opacity: 1;
}
</style>
