#!/usr/bin/env node
/**
 * Renders the "Image protection" designer doc (the same copy shown in the
 * toon editor's account menu → Image protection dialog) to a standalone PDF.
 *
 * English (default): pulls the prose straight out of ImageProtectionInfo.vue's
 * template rather than keeping a second copy, so the PDF can't quietly drift
 * from what's live in the editor. It's just the static markup — no Vue
 * runtime involved, no dev server needed.
 *
 * --lang=it: the editor UI itself stays English-only (an internal admin
 * tool, no i18n system there), so this reads a hand-kept translation from
 * scripts/lib/image-protection-content.it.html instead. If the English
 * source changes, that file needs updating by hand to match — there's no
 * automated sync.
 *
 * Usage:
 *   npm run generate-image-protection-pdf
 *   npm run generate-image-protection-pdf:it
 *   npm run generate-image-protection-pdf -- --lang=it ~/Desktop/protezione-immagini.pdf
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const args = process.argv.slice(2);
const langArg = args.find((a) => a.startsWith("--lang="));
const LANG = langArg ? langArg.slice("--lang=".length) : "en";
const OUTPUT_ARG = args.find((a) => !a.startsWith("--"));

const SOURCE = path.join(__dirname, "..", "src/toons/editor/components/ImageProtectionInfo.vue");
const IT_SOURCE = path.join(__dirname, "lib", "image-protection-content.it.html");
const OUTPUT =
  OUTPUT_ARG ||
  path.join(os.homedir(), "Downloads", LANG === "it" ? "image-protection-it.pdf" : "image-protection.pdf");

function extractDocMarkup(vueSource) {
  const start = vueSource.indexOf('<div class="editor-protection-doc">');
  if (start === -1) throw new Error('Could not find <div class="editor-protection-doc"> in ImageProtectionInfo.vue');
  const openTagEnd = vueSource.indexOf(">", start) + 1;

  // Walk nested <div ...> / </div> pairs from there to find this div's real close tag —
  // a plain indexOf("</div>") would stop at the first nested one instead.
  let depth = 1;
  let cursor = openTagEnd;
  const tagRe = /<\/?div\b[^>]*>/g;
  tagRe.lastIndex = openTagEnd;
  let match;
  while ((match = tagRe.exec(vueSource))) {
    if (match[0].startsWith("</")) depth -= 1;
    else if (!match[0].endsWith("/>")) depth += 1;
    if (depth === 0) {
      cursor = match.index;
      break;
    }
  }
  if (depth !== 0) throw new Error("Unbalanced <div> tags while extracting doc markup");
  return vueSource.slice(openTagEnd, cursor).trim();
}

const COPY = {
  en: {
    htmlLang: "en",
    title: "Image protection",
    generatedBy: "generated",
    footer: "for internal / designer reference",
  },
  it: {
    htmlLang: "it",
    title: "Protezione immagini",
    generatedBy: "generato il",
    footer: "per uso interno / riferimento designer",
  },
};

function toPrintHtml(bodyMarkup, lang) {
  const copy = COPY[lang] || COPY.en;
  const generated = new Date().toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="${copy.htmlLang}">
<head>
<meta charset="utf-8" />
<title>${copy.title} — 27 Pictures</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.55;
    font-size: 11.5pt;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 2px solid #b30000;
    padding-bottom: 10px;
    margin-bottom: 22px;
  }
  header h1 { font-size: 20pt; margin: 0; }
  header span { font-size: 9pt; color: #777; }
  .editor-protection-doc { display: flex; flex-direction: column; gap: 20px; }
  .editor-protection-doc section { break-inside: avoid; display: flex; flex-direction: column; gap: 6px; }
  .editor-list-heading { font-size: 13pt; margin: 0 0 2px; color: #111; }
  .editor-protection-doc p { margin: 0; }
  .editor-muted { color: #555; }
  .editor-protection-list { margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: 6px; }
  code {
    background: #f1f1f1;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: 0.05em 0.35em;
    font-size: 0.92em;
  }
  a { color: #b30000; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 8.5pt; color: #999; }
</style>
</head>
<body>
  <header>
    <h1>${copy.title}</h1>
    <span>27 Pictures &middot; ${copy.generatedBy} ${generated}</span>
  </header>
  ${bodyMarkup}
  <footer>twentyseven.pictures &middot; ${copy.footer}</footer>
</body>
</html>
`;
}

function findChrome() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/opt/homebrew/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) return found;
  throw new Error("No local Chrome/Chromium found. Install Google Chrome or Chromium and re-run.");
}

function main() {
  let bodyMarkup;
  if (LANG === "it") {
    bodyMarkup = fs.readFileSync(IT_SOURCE, "utf8").trim();
  } else {
    const vueSource = fs.readFileSync(SOURCE, "utf8");
    bodyMarkup = extractDocMarkup(vueSource);
  }
  const html = toPrintHtml(bodyMarkup, LANG);

  const tmpHtml = path.join(os.tmpdir(), `image-protection-${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, html, "utf8");
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

  const chrome = findChrome();
  const result = spawnSync(
    chrome,
    ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${OUTPUT}`, `file://${tmpHtml}`],
    { stdio: ["ignore", "inherit", "ignore"] } // Chrome's own stderr is just headless/GPU noise on macOS
  );

  fs.unlinkSync(tmpHtml);

  if (result.status !== 0) {
    console.error("Chrome PDF render failed");
    process.exit(result.status || 1);
  }
  console.log(`PDF saved to: ${OUTPUT}`);
}

main();
