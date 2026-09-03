import { createRouter, createWebHashHistory } from "vue-router";
import ToonList from "./components/ToonList.vue";
import ToonMetaForm from "./components/ToonMetaForm.vue";
import SeriesForm from "./components/SeriesForm.vue";
import PageStudio from "./components/PageStudio.vue";
import UsersView from "./components/UsersView.vue";

export const router = createRouter({
  // Hash history: this is an MPA entry. Vite `appType: "mpa"` and Pages have
  // no SPA fallback for `/toons/editor/:id`, so a real path would 404 on reload.
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "list", component: ToonList },
    { path: "/new", name: "new", component: ToonMetaForm },
    { path: "/series/new", name: "series-new", component: SeriesForm },
    { path: "/series/:key", name: "series-edit", component: SeriesForm },
    // Admin-only screen: the session isn't available to a module-level guard
    // (it's provided inside AuthGate's component tree), so UsersView itself
    // redirects a non-admin on mount. The real enforcement is the backend's
    // 403 on POST /auth/users.
    { path: "/users", name: "users", component: UsersView },
    { path: "/:id", name: "meta", component: ToonMetaForm },
    { path: "/:id/pages/:pageId?", name: "studio", component: PageStudio },
  ],
});
