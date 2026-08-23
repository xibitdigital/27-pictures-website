<script setup lang="ts">
/** Main site chrome (fixed header + mobile menu). */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";
import { documentLocale, isLocalizedPath, LOCALES, LOCALE_LABELS, LOCALE_NAMES, localePath, UI } from "../i18n";

const props = withDefaults(
  defineProps<{
    page?: "home" | "toons" | "cosplay" | "horror-shorts" | "watch";
  }>(),
  { page: "home" }
);

const menuOpen = ref(false);
const langOpen = ref(false);
const langRoot = ref<HTMLElement | null>(null);

/**
 * The locale comes from the page's <html lang>, not from a prop: every page
 * already declares it, and reading it here means no entry module or build flag
 * has to pass it down.
 */
const locale = documentLocale();
const t = UI[locale];

/**
 * Away from the homepage, section anchors must point back at it — and back at
 * the homepage *of this locale*, or a German page would send you to English
 * copy for the same section.
 */
const section = (hash: string) => (props.page === "home" ? hash : localePath(`/${hash}`, locale));

const currentPath = typeof window === "undefined" ? "/" : window.location.pathname;
/** Only pages with a real translated document get a language switcher. */
const showLangs = isLocalizedPath(currentPath);

/** Every locale, including this one — the current code is the selected chip. */
const languages = computed(() =>
  LOCALES.map((code) => ({
    code,
    label: LOCALE_LABELS[code],
    name: LOCALE_NAMES[code],
    href: localePath(currentPath, code),
    current: code === locale,
  }))
);

/**
 * The logo was the one nav target still hardcoded to `/`, so clicking it from
 * /it/watch/ landed on the English homepage — a language reset in the element
 * people press to go home. Every other link here already goes through
 * localePath(); this one was simply missed, and a Vue component's hrefs are
 * never touched by the locale-page generator that rewrites HTML templates.
 */
const homeHref = localePath("/", locale);

const links = computed(() => [
  { href: localePath("/horror-shorts/", locale), label: t.darkroom, current: props.page === "horror-shorts" },
  { href: localePath("/watch/", locale), label: t.watch, current: props.page === "watch" },
  { href: localePath("/toons/", locale), label: t.toons, current: props.page === "toons" },
  { href: localePath("/cosplay/", locale), label: t.cosplay, current: props.page === "cosplay" },
  { href: section("#contact"), label: t.contact },
]);

watch(menuOpen, (open) => {
  document.body.style.overflow = open ? "hidden" : "";
});

function closeMenu(): void {
  menuOpen.value = false;
}

function closeLangs(): void {
  langOpen.value = false;
}

function onDocPointerDown(event: PointerEvent): void {
  if (langRoot.value && !langRoot.value.contains(event.target as Node)) closeLangs();
}

function onDocKey(event: KeyboardEvent): void {
  if (event.key === "Escape") closeLangs();
}

/** Mobile menu: a native select opens the OS picker, then we go to that locale. */
function onLangSelect(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  const next = languages.value.find((l) => l.code === value);
  if (!next || next.current) return;
  closeMenu();
  window.location.assign(next.href);
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocPointerDown);
  document.addEventListener("keydown", onDocKey);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", onDocPointerDown);
  document.removeEventListener("keydown", onDocKey);
});
</script>

<template>
  <header>
    <nav role="navigation" :aria-label="t.navMain">
      <a v-magnetic :href="homeHref" class="magnetic" :aria-label="t.navHomeAria">
        <img src="/logo.1a83b92ec2.png" class="nav-logo-img" alt="27 Pictures" :title="t.navLogoTitle" height="40" />
      </a>

      <button
        type="button"
        class="burger-btn"
        :class="{ active: menuOpen }"
        :aria-label="t.navToggleMenu"
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
        <!-- Locale switcher: plain links, so each locale is a crawlable URL and
             a right-click still works. No IP sniffing and no auto-redirect —
             both hide content from people and from crawlers. Hidden on pages
             that have no translated document. -->
        <div
          v-if="showLangs"
          ref="langRoot"
          class="nav-langs"
          :class="{ 'is-open': langOpen }"
          role="group"
          :aria-label="t.language"
        >
          <button
            type="button"
            class="nav-lang-toggle"
            :aria-expanded="langOpen"
            :aria-label="t.language + ': ' + LOCALE_NAMES[locale]"
            @click="langOpen = !langOpen"
          >
            <span aria-hidden="true">{{ LOCALE_LABELS[locale] }}</span>
            <svg class="nav-lang-chevron" width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5 L6 8 L9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
          <div class="nav-lang-menu">
            <a
              v-for="l in languages"
              :key="l.code"
              class="nav-lang"
              :href="l.href"
              :hreflang="l.code"
              :lang="l.code"
              :aria-current="l.current ? 'true' : undefined"
              @click="closeLangs"
            >
              <span class="nav-lang-code" aria-hidden="true">{{ l.label }}</span>
              <span class="nav-lang-name">{{ l.name }}</span>
            </a>
          </div>
        </div>
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
        <div class="mobile-menu active" :aria-label="t.navMobileMenu">
          <DialogPanel class="mobile-menu-panel">
            <DialogTitle class="sr-only">{{ t.navMenu }}</DialogTitle>
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
            <div v-if="showLangs" class="nav-lang-select-wrap">
              <label class="nav-lang-select-label" for="nav-lang-select">{{ t.language }}</label>
              <select
                id="nav-lang-select"
                class="nav-lang-select"
                :value="locale"
                :aria-label="t.language"
                @change="onLangSelect"
              >
                <option v-for="l in languages" :key="'ml-' + l.code" :value="l.code" :lang="l.code">
                  {{ l.label }} · {{ l.name }}
                </option>
              </select>
            </div>
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
