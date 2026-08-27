import { createRouter, createWebHashHistory } from "vue-router";
import ToonList from "./components/ToonList.vue";
import ToonMetaForm from "./components/ToonMetaForm.vue";
import PageStudio from "./components/PageStudio.vue";

export const router = createRouter({
  // Hash history: this is an MPA entry. Vite `appType: "mpa"` and Pages have
  // no SPA fallback for `/toons/editor/:id`, so a real path would 404 on reload.
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "list", component: ToonList },
    { path: "/new", name: "new", component: ToonMetaForm },
    { path: "/:id", name: "meta", component: ToonMetaForm },
    { path: "/:id/pages/:pageId?", name: "studio", component: PageStudio },
  ],
});
