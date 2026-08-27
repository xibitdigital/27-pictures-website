<script setup lang="ts">
import { onMounted, provide, ref } from "vue";
import LoginForm from "./components/LoginForm.vue";
import { authStatus, clearToken, editorApiBase, fetchMe, getToken, logout as apiLogout, type EditorUser } from "./api";
import { EDITOR_LOGOUT_KEY, EDITOR_USER_KEY } from "./session";

const configured = Boolean(editorApiBase());
const loading = ref(true);
const hasUsers = ref(true);
const user = ref<EditorUser | null>(null);
const apiError = ref("");

async function signOut(): Promise<void> {
  await apiLogout();
  user.value = null;
  try {
    hasUsers.value = (await authStatus()).hasUsers;
  } catch {
    hasUsers.value = true;
  }
}

provide(EDITOR_USER_KEY, user);
provide(EDITOR_LOGOUT_KEY, signOut);

async function refresh(): Promise<void> {
  if (!configured) {
    loading.value = false;
    return;
  }
  loading.value = true;
  apiError.value = "";
  try {
    const status = await authStatus();
    hasUsers.value = status.hasUsers;
    if (!getToken()) {
      user.value = null;
      return;
    }
    try {
      const me = await fetchMe();
      user.value = me.user;
    } catch {
      clearToken();
      user.value = null;
    }
  } catch (err) {
    user.value = null;
    apiError.value = err instanceof Error ? err.message : "Can't reach the editor API.";
  } finally {
    loading.value = false;
  }
}

function onLoggedIn(next: EditorUser): void {
  user.value = next;
  hasUsers.value = true;
}

onMounted(refresh);
</script>

<template>
  <div v-if="!configured" class="editor-gate">
    <p>Set <code>VITE_EDITOR_API</code> to the toon-editor Worker origin.</p>
  </div>
  <p v-else-if="loading" class="editor-gate">Loading…</p>
  <div v-else-if="apiError" class="editor-gate">
    <p class="editor-error" role="alert">{{ apiError }}</p>
  </div>
  <LoginForm v-else-if="!user" :has-users="hasUsers" @logged-in="onLoggedIn" />
  <slot v-else />
</template>
