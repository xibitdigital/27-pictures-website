<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { getUserKeys, saveUserKey } from "../api";
import { pushToast } from "../toast";
import { USER_KEY_LABELS, USER_KEY_NAMES, type UserKeyName, type UserKeyStatus } from "../types";
import EditorBar from "./EditorBar.vue";

const status = ref<UserKeyStatus | null>(null);
const loading = ref(true);
const draft = reactive<Record<UserKeyName, string>>({
  replicateApiToken: "",
  comfyApiKey: "",
  elevenlabsApiKey: "",
  runwareApiToken: "",
  runcomfyApiToken: "",
});
const savingKey = ref<UserKeyName | null>(null);

onMounted(async () => {
  try {
    status.value = await getUserKeys();
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not load key status");
  } finally {
    loading.value = false;
  }
});

async function onSave(name: UserKeyName): Promise<void> {
  const value = draft[name].trim();
  if (!value || savingKey.value) return;
  savingKey.value = name;
  try {
    status.value = await saveUserKey(name, value);
    draft[name] = "";
    pushToast(`${USER_KEY_LABELS[name]} saved`, "success");
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not save key");
  } finally {
    savingKey.value = null;
  }
}

async function onClear(name: UserKeyName): Promise<void> {
  if (savingKey.value) return;
  savingKey.value = name;
  try {
    status.value = await saveUserKey(name, null);
    draft[name] = "";
    pushToast(`${USER_KEY_LABELS[name]} cleared — back to the shared key`, "success");
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Could not clear key");
  } finally {
    savingKey.value = null;
  }
}
</script>

<template>
  <div class="editor-page">
    <EditorBar title="Settings" />
    <div class="editor-page-body">
      <div class="editor-form">
        <section>
          <h2 class="editor-list-heading">Your API keys</h2>
          <p class="editor-muted">
            Optional — set your own key for a provider to use it instead of the shared one for your own generations.
            Leave a key unset and generation keeps working off the shared key. Keys are encrypted and never shown again
            once saved. For Replicate, paste the full <code>r8_</code> token shown once at creation — not the masked
            list value, and not <code>Bearer …</code>. For Runware, paste the key from <code>runware.ai/api-keys</code>.
            “Set” only means a value is stored.
          </p>
          <p v-if="loading" class="editor-muted">Loading…</p>
          <ul v-else class="editor-user-roster">
            <li v-for="name in USER_KEY_NAMES" :key="name" class="editor-user-row">
              <span class="editor-user-row-info">
                <strong>{{ USER_KEY_LABELS[name] }}</strong>
                <span class="editor-muted">{{ status?.[name] ? "Set" : "Not set — using the shared key" }}</span>
              </span>
              <span class="editor-user-row-actions">
                <input
                  v-model="draft[name]"
                  type="password"
                  autocomplete="off"
                  class="editor-key-input"
                  :name="`key-${name}`"
                  :aria-label="`New ${USER_KEY_LABELS[name]}`"
                  placeholder="New key…"
                />
                <button
                  class="editor-btn editor-btn--ghost"
                  type="button"
                  :disabled="!draft[name].trim() || savingKey === name"
                  @click="onSave(name)"
                >
                  {{ savingKey === name ? "Saving…" : "Save" }}
                </button>
                <button
                  v-if="status?.[name]"
                  class="editor-btn editor-btn--ghost"
                  type="button"
                  :disabled="savingKey === name"
                  @click="onClear(name)"
                >
                  Clear
                </button>
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
