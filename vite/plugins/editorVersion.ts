import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Writes `dist/toons/editor/version.json` (`{ "build": "<stamp>" }`) so the running editor SPA can
 * poll for a newer deploy and prompt the operator to reload, instead of silently serving a stale
 * bundle until the next hard refresh — see `src/toons/editor/updateCheck.ts`. The same `build`
 * stamp is baked into the JS bundle itself via `import.meta.env.VITE_EDITOR_BUILD` (vite.config.ts's
 * `define`); this file is only the fetchable copy a *running* tab can compare itself against
 * without re-downloading its own JS.
 */
export function editorVersionFile(build: string): Plugin {
  let outDir = "dist";

  return {
    name: "editor-version-file",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const editorDir = path.join(outDir, "toons/editor");
      if (!fs.existsSync(editorDir)) return; // editor entry not in this build (e.g. a partial build)
      fs.writeFileSync(path.join(editorDir, "version.json"), JSON.stringify({ build }));
    },
  };
}
