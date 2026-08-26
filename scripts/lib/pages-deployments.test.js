import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const { selectPruneTargets } = createRequire(import.meta.url)("./pages-deployments.js");

function dep(id, { created, aliases = [], skipped = false } = {}) {
  return {
    id,
    short_id: id.slice(0, 8),
    created_on: created,
    aliases,
    is_skipped: skipped,
    url: `https://${id.slice(0, 8)}.example.pages.dev`,
  };
}

describe("selectPruneTargets", () => {
  it("keeps the newest snapshot and deletes older unaliased ones", () => {
    const list = [
      dep("old-a", { created: "2026-08-01T00:00:00Z" }),
      dep("new-1", { created: "2026-08-26T10:00:00Z" }),
      dep("old-b", { created: "2026-08-10T00:00:00Z" }),
    ];
    const gone = selectPruneTargets(list).map((d) => d.id);
    expect(gone.sort()).toEqual(["old-a", "old-b"]);
  });

  it("never deletes a deployment that still has a branch alias", () => {
    const list = [
      dep("aliased-old", {
        created: "2026-08-01T00:00:00Z",
        aliases: ["https://staging.example.pages.dev"],
      }),
      dep("new-1", { created: "2026-08-26T10:00:00Z" }),
    ];
    expect(selectPruneTargets(list).map((d) => d.id)).toEqual([]);
  });

  it("does not delete the newest even if it has no alias yet", () => {
    const list = [dep("only", { created: "2026-08-26T10:00:00Z" })];
    expect(selectPruneTargets(list)).toEqual([]);
  });

  it("honours --keep for a rollback snapshot", () => {
    const list = [
      dep("keep-new", { created: "2026-08-26T12:00:00Z" }),
      dep("keep-prev", { created: "2026-08-26T11:00:00Z" }),
      dep("old", { created: "2026-08-01T00:00:00Z" }),
    ];
    expect(selectPruneTargets(list, { keep: 2 }).map((d) => d.id)).toEqual(["old"]);
  });

  it("treats skipped deploys as unused", () => {
    const list = [
      dep("live", { created: "2026-08-26T12:00:00Z" }),
      dep("skip", { created: "2026-08-26T13:00:00Z", skipped: true }),
    ];
    expect(selectPruneTargets(list).map((d) => d.id)).toEqual(["skip"]);
  });
});
