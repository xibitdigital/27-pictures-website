import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hashedCss } from "./hashedCss";

let out: string;

/** Runs the plugin over a throwaway dist/ and returns what it left behind. */
async function run(): Promise<{ files: string[]; html: (rel: string) => string }> {
  const plugin = hashedCss();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = plugin as any;
  p.configResolved({ root: out, build: { outDir: out } });
  await p.closeBundle.call({ warn: () => {} });

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else files.push(path.relative(out, full));
    }
  };
  walk(out);
  return { files, html: (rel) => fs.readFileSync(path.join(out, rel), "utf8") };
}

beforeEach(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), "hashedcss-"));
  fs.mkdirSync(path.join(out, "toons", "erin"), { recursive: true });
  fs.writeFileSync(path.join(out, "styles.css"), "body{color:#fff}");
  fs.writeFileSync(path.join(out, "toons", "reader-shared.css"), ".reader{}");
});

afterEach(() => fs.rmSync(out, { recursive: true, force: true }));

describe("hashedCss", () => {
  it("emits a content-hashed copy and rewrites the reference", async () => {
    fs.writeFileSync(path.join(out, "index.html"), '<link rel="stylesheet" href="/styles.css" />');
    const { files, html } = await run();

    const hashed = files.find((f) => /^styles\.[a-f0-9]{10}\.css$/.test(f));
    expect(hashed).toBeTruthy();
    expect(html("index.html")).toContain(`/${hashed}`);
  });

  it("removes the unhashed copy, so no mutable path is served as immutable", async () => {
    fs.writeFileSync(path.join(out, "index.html"), '<link href="/styles.css" />');
    const { files } = await run();
    expect(files).not.toContain("styles.css");
    expect(files).not.toContain(path.join("toons", "reader-shared.css"));
  });

  it("replaces a leftover ?v= query rather than stacking on it", async () => {
    fs.writeFileSync(path.join(out, "index.html"), '<link href="/styles.css?v=deadbeef01" />');
    const { html } = await run();
    const result = html("index.html");
    expect(result).not.toContain("?v=");
    expect(result).toMatch(/href="\/styles\.[a-f0-9]{10}\.css"/);
  });

  it("changes the hash when the contents change, and only then", async () => {
    // Read the name off the HTML, not off the directory: earlier runs leave
    // their hashed copies behind, exactly as consecutive deploys do.
    const referenced = async () => /styles\.[a-f0-9]{10}\.css/.exec((await run()).html("index.html"))?.[0];
    const rebuild = (css: string) => {
      fs.writeFileSync(path.join(out, "styles.css"), css);
      fs.writeFileSync(path.join(out, "index.html"), '<link href="/styles.css" />');
    };

    rebuild("body{color:#fff}");
    const first = await referenced();
    expect(first).toBeTruthy();

    rebuild("body{color:#fff}");
    expect(await referenced()).toBe(first);

    rebuild("body{color:#000}");
    expect(await referenced()).not.toBe(first);
  });

  it("rewrites nested pages and relative hrefs too", async () => {
    fs.writeFileSync(path.join(out, "toons", "erin", "index.html"), '<link href="/toons/reader-shared.css" />');
    const { html } = await run();
    expect(html(path.join("toons", "erin", "index.html"))).toMatch(/href="\/toons\/reader-shared\.[a-f0-9]{10}\.css"/);
  });

  it("leaves unrelated css and query strings alone", async () => {
    fs.writeFileSync(
      path.join(out, "index.html"),
      '<link href="https://fonts.googleapis.com/css2?family=Inter" /><a href="/watch?v=abc123">x</a>'
    );
    const { html } = await run();
    const result = html("index.html");
    expect(result).toContain("fonts.googleapis.com/css2?family=Inter");
    expect(result).toContain("/watch?v=abc123");
  });
});
