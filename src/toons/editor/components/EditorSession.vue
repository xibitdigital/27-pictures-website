<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { fetchCredits } from "../api";
import { EDITOR_LOGOUT_KEY, EDITOR_USER_KEY } from "../session";
import type { CreditsSnapshot } from "../types";

const userRef = inject(EDITOR_USER_KEY);
const signOut = inject(EDITOR_LOGOUT_KEY);
const email = computed(() => userRef?.value?.email ?? "");
const initial = computed(() => (email.value ? email.value.slice(0, 1).toUpperCase() : "?"));
const loading = ref(false);
const credits = ref<CreditsSnapshot | null>(null);
const creditError = ref("");
let creditsInflight = false;

function formatCount(n: number): string {
  return n.toLocaleString("en-GB");
}

function bucketLine(used: number, limit: number | null, unit: string): string {
  const suffix = unit === "chars" ? " chars" : "";
  if (limit == null) return `${formatCount(used)}${suffix}`;
  return `${formatCount(used)} / ${formatCount(limit)}${suffix}`;
}

const audioLine = computed(() => {
  const audio = credits.value?.audio;
  if (!audio) return "—";
  return bucketLine(audio.used, audio.limit, audio.unit);
});

const imageLine = computed(() => {
  const image = credits.value?.image;
  if (!image) return "—";
  return bucketLine(image.used, image.limit, image.unit);
});

async function onToggle(ev: Event): Promise<void> {
  const details = ev.target as HTMLDetailsElement;
  if (!details.open || creditsInflight) return;
  creditsInflight = true;
  loading.value = true;
  creditError.value = "";
  try {
    credits.value = await fetchCredits();
  } catch (err) {
    creditError.value = err instanceof Error ? err.message : "Could not load credits";
  } finally {
    loading.value = false;
    creditsInflight = false;
  }
}
</script>

<template>
  <details v-if="email" class="editor-account" name="account-menu" @toggle="onToggle">
    <summary class="editor-account-btn" aria-label="Account menu">
      <span class="editor-account-avatar" aria-hidden="true">{{ initial }}</span>
    </summary>
    <div class="editor-account-panel">
      <p class="editor-account-email">{{ email }}</p>
      <p v-if="loading" class="editor-muted">Loading credits…</p>
      <p v-else-if="creditError" class="editor-error" role="alert">{{ creditError }}</p>
      <dl v-else-if="credits" class="editor-account-credits">
        <div>
          <dt>Audio this period</dt>
          <dd>{{ audioLine }}</dd>
        </div>
        <div>
          <dt>Image this month</dt>
          <dd>{{ imageLine }}</dd>
        </div>
      </dl>
      <button v-if="signOut" class="editor-btn editor-btn--ghost" type="button" name="logout" @click="signOut">
        Log out
      </button>
    </div>
  </details>
</template>
