import type { InjectionKey, Ref } from "vue";
import type { EditorUser } from "./api";

export const EDITOR_USER_KEY: InjectionKey<Ref<EditorUser | null>> = Symbol("editor-user");
export const EDITOR_LOGOUT_KEY: InjectionKey<() => Promise<void>> = Symbol("editor-logout");
