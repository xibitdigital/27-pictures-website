<script setup lang="ts">
import { X } from "@lucide/vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { EditorUser } from "../../types";

const props = defineProps<{
  modelValue: string[];
  options: EditorUser[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const query = ref("");
const open = ref(false);
const highlight = ref(0);
const inputEl = ref<HTMLInputElement | null>(null);
const rootEl = ref<HTMLElement | null>(null);

const selected = computed(() =>
  props.modelValue
    .map((id) => props.options.find((user) => user.id === id))
    .filter((user): user is EditorUser => Boolean(user))
);

const available = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.options.filter((user) => {
    if (props.modelValue.includes(user.id)) return false;
    if (!q) return true;
    return user.username.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
  });
});

function add(id: string): void {
  if (props.modelValue.includes(id)) return;
  emit("update:modelValue", [...props.modelValue, id]);
  query.value = "";
  highlight.value = 0;
  open.value = true;
  void nextTick(() => inputEl.value?.focus());
}

function remove(id: string): void {
  emit(
    "update:modelValue",
    props.modelValue.filter((existing) => existing !== id)
  );
}

function onFocus(): void {
  open.value = true;
}

function onQuery(): void {
  open.value = true;
  highlight.value = 0;
}

function onKey(ev: KeyboardEvent): void {
  if (ev.key === "Escape") {
    open.value = false;
    return;
  }
  if (ev.key === "Backspace" && !query.value && props.modelValue.length) {
    ev.preventDefault();
    remove(props.modelValue[props.modelValue.length - 1]);
    return;
  }
  if (!available.value.length) return;
  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    open.value = true;
    highlight.value = (highlight.value + 1) % available.value.length;
  } else if (ev.key === "ArrowUp") {
    ev.preventDefault();
    open.value = true;
    highlight.value = (highlight.value - 1 + available.value.length) % available.value.length;
  } else if (ev.key === "Enter") {
    ev.preventDefault();
    const pick = available.value[highlight.value] ?? available.value[0];
    if (pick) add(pick.id);
  }
}

function onDocPointer(ev: PointerEvent): void {
  if (!rootEl.value?.contains(ev.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener("pointerdown", onDocPointer));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocPointer));
</script>

<template>
  <div ref="rootEl" class="editor-pills" data-editor-pills>
    <div v-if="selected.length" class="editor-pills-selected">
      <span v-for="user in selected" :key="user.id" class="editor-pill">
        {{ user.username }}
        <button
          class="editor-pill-remove"
          type="button"
          :name="`editor-remove-${user.id}`"
          :aria-label="`Remove ${user.username}`"
          @click="remove(user.id)"
        >
          <X :size="12" :stroke-width="2.2" aria-hidden="true" />
        </button>
      </span>
    </div>
    <input
      ref="inputEl"
      v-model="query"
      name="editor-search"
      type="text"
      autocomplete="off"
      placeholder="Add editor…"
      aria-autocomplete="list"
      :aria-expanded="open && available.length > 0"
      @focus="onFocus"
      @input="onQuery"
      @keydown="onKey"
    />
    <ul v-if="open && available.length" class="editor-pills-menu" role="listbox">
      <li
        v-for="(user, index) in available"
        :key="user.id"
        role="option"
        :data-editor-option="user.id"
        :aria-selected="index === highlight"
        @mousedown.prevent="add(user.id)"
      >
        {{ user.username }} ({{ user.email }})
      </li>
    </ul>
  </div>
</template>
