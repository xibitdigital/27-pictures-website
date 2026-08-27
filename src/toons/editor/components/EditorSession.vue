<script setup lang="ts">
import { computed, inject } from "vue";
import { EDITOR_LOGOUT_KEY, EDITOR_USER_KEY } from "../session";

const userRef = inject(EDITOR_USER_KEY);
const signOut = inject(EDITOR_LOGOUT_KEY);
const email = computed(() => userRef?.value?.email ?? "");
</script>

<template>
  <span v-if="email" class="editor-session">
    <span class="editor-muted">{{ email }}</span>
    <button v-if="signOut" class="editor-btn editor-btn--ghost" type="button" @click="signOut">Log out</button>
  </span>
</template>
