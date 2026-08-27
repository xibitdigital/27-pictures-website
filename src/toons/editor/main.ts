import { createApp } from "vue";
import EditorApp from "./EditorApp.vue";
import { router } from "./router";
import "./editor.css";

createApp(EditorApp).use(router).mount("#app");
