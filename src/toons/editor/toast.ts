import { reactive } from "vue";

export type ToastKind = "error" | "success";

export interface ToastEntry {
  id: number;
  kind: ToastKind;
  message: string;
  durationMs: number;
}

const DEFAULT_DURATION_MS = 6000;

let nextId = 1;

export const toasts = reactive<ToastEntry[]>([]);

export function dismissToast(id: number): void {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}

export function pushToast(message: string, kind: ToastKind = "error", durationMs = DEFAULT_DURATION_MS): void {
  if (!message) return;
  toasts.push({ id: nextId++, kind, message, durationMs });
}
