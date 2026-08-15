<script setup lang="ts">
import { computed } from "vue";
import SiteNav from "./components/SiteNav.vue";
import ContactForm from "./components/ContactForm.vue";

const props = withDefaults(
  defineProps<{
    /** Which marketing page is hosting the chrome. */
    page?: "home" | "toons" | "cosplay" | "horror-shorts" | "watch";
  }>(),
  { page: "home" }
);

const showContactTeleport = computed(() => props.page === "home");
</script>

<template>
  <SiteNav :page="page" />
  <!-- Contact form only exists on the homepage mount point. -->
  <Teleport v-if="showContactTeleport" to="#contact-form-app">
    <ContactForm />
  </Teleport>
</template>
