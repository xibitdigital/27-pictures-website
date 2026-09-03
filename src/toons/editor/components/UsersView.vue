<script setup lang="ts">
import { inject, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { inviteUser } from "../api";
import { EDITOR_USER_KEY } from "../session";
import { pushToast } from "../toast";
import type { UserRole } from "../types";
import EditorBar from "./EditorBar.vue";

const router = useRouter();
const userRef = inject(EDITOR_USER_KEY);

onMounted(() => {
  if (userRef?.value && userRef.value.role !== "admin") router.replace("/");
});

const username = ref("");
const email = ref("");
const role = ref<UserRole>("editor");
const saving = ref(false);

async function onSubmit(ev: Event): Promise<void> {
  ev.preventDefault();
  saving.value = true;
  try {
    const result = await inviteUser({ username: username.value.trim(), email: email.value.trim(), role: role.value });
    if (result.emailSent) {
      pushToast(`Invite sent to ${result.user.email}`, "success");
    } else {
      pushToast(
        `Account created for ${result.user.email}, but the invite email failed to send — ask an admin to relay access another way.`,
        "error"
      );
    }
    username.value = "";
    email.value = "";
    role.value = "editor";
  } catch (err) {
    pushToast(err instanceof Error ? err.message : "Invite failed");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="editor-page">
    <EditorBar title="Invite user">
      <template #actions>
        <button class="editor-btn" type="submit" form="invite-user" :disabled="saving">
          {{ saving ? "Sending…" : "Send invite" }}
        </button>
      </template>
    </EditorBar>
    <form id="invite-user" class="editor-form" novalidate @submit="onSubmit">
      <div class="editor-form-main">
        <label>
          Username
          <input v-model="username" name="username" required autocomplete="off" />
        </label>
        <label>
          Email
          <input v-model="email" type="email" name="email" required autocomplete="off" />
        </label>
        <label>
          Role
          <select v-model="role" name="role">
            <option value="editor">Editor — can create series/toons, capped at draft or staging</option>
            <option value="admin">Admin — full access, can publish</option>
          </select>
        </label>
        <p class="editor-muted">
          A password is generated automatically and emailed to the invited address — it is never shown here.
        </p>
      </div>
    </form>
  </div>
</template>
