import { describe, it, expect } from "vitest";
import { diffVisiblePages, isPureSubset, isPureSuperset, pageKey, parsePageKey } from "./queuePolicy";

const page = (id: string) => ({ id });

describe("queuePolicy", () => {
  it("parses and joins page keys", () => {
    expect(parsePageKey("8|9")).toEqual(["8", "9"]);
    expect(pageKey(["8", "9"])).toBe("8|9");
    expect(parsePageKey("")).toEqual([]);
  });

  it("detects pure subset / superset", () => {
    expect(isPureSubset(["8"], ["8", "9"])).toBe(true);
    expect(isPureSubset(["8", "9"], ["8"])).toBe(false);
    expect(isPureSuperset(["8", "9"], ["8"])).toBe(true);
    // Still a pure set-superset (every prev id remains); expand also requires +1 length.
    expect(isPureSuperset(["8", "10"], ["8"])).toBe(true);
    expect(isPureSuperset(["10"], ["8"])).toBe(false);
  });

  it("noops when the same view is still running or already done", () => {
    const ordered = [page("1")];
    expect(diffVisiblePages("1", ordered, new Set(["1"]), { running: true, doneKey: "" }).kind).toBe("noop");
    expect(diffVisiblePages("1", ordered, new Set(["1"]), { running: false, doneKey: "1" }).kind).toBe("noop");
  });

  it("subsets when a page leaves mid-view", () => {
    const d = diffVisiblePages("8|9", [page("8")], new Set(["8", "9"]), {
      running: true,
      doneKey: "",
    });
    expect(d).toEqual({ kind: "subset", key: "8", wantedIds: ["8"] });
  });

  it("expands by exactly one fresh page", () => {
    const d = diffVisiblePages("10", [page("10"), page("11")], new Set(["10"]), {
      running: true,
      doneKey: "",
    });
    expect(d.kind).toBe("expand");
    if (d.kind === "expand") {
      expect(d.key).toBe("10|11");
      expect(d.append.map((p) => p.id)).toEqual(["11"]);
    }
  });

  it("replaces on hard navigation (skips intermediate pages)", () => {
    const d = diffVisiblePages("1", [page("3")], new Set(["1"]), {
      running: false,
      doneKey: "",
    });
    expect(d.kind).toBe("replace");
    if (d.kind === "replace") {
      expect(d.toRead.map((p) => p.id)).toEqual(["3"]);
    }
  });
});
