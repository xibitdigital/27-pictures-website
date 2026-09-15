/**
 * Creator-site HTML (toons.twentyseven.pictures): catalog home and editor portfolios.
 * Hubs and readers reuse the shared _hub / _reader templates with community chrome.
 */
import { APEX, catalogJsonLd, landingGridHtml, payloadForEditor, type CatalogPayload } from "./catalogRender";
import { COMMUNITY_RESERVED_SEGMENTS, COMMUNITY_STAGING_HOST } from "./communityHost";
import { breadcrumbNavHtml, toonTrail } from "./breadcrumb";
import { splitLocale, UI } from "./i18n";

export const COMMUNITY_TEMPLATE_PATH = "/toons/_community/";

const APEX_STUDIO_PREFIXES = ["/watch/", "/cosplay/", "/horror-shorts/"];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function replaceAttrText(html: string, attr: string, value: string): string {
  const re = new RegExp(`(<[^>]*\\b${attr}\\b[^>]*>)([\\s\\S]*?)(</[^>]+>)`, "g");
  return html.replace(re, (_, open: string, _inner: string, close: string) => `${open}${value}${close}`);
}

function fillEmptyDiv(html: string, attr: string, inner: string): string {
  const re = new RegExp(`(<div\\b[^>]*\\b${attr}\\b[^>]*>)\\s*(</div>)`);
  if (!re.test(html)) return html;
  return html.replace(re, `$1\n${inner}\n            $2`);
}

function replaceScript(html: string, attr: string, json: unknown): string {
  const open = `<script type="application/ld+json" ${attr}>`;
  const start = html.indexOf(open);
  if (start < 0) return html;
  const end = html.indexOf("</script>", start);
  if (end < 0) return html;
  return `${html.slice(0, start)}${open}\n${JSON.stringify(json, null, 2)}\n    </script>${html.slice(
    end + "</script>".length
  )}`;
}

function setMeta(html: string, attr: string, name: string, content: string): string {
  const re = new RegExp(`(<meta[^>]*${attr}="${name}"[^>]*content=")[^"]*(")`);
  if (re.test(html)) return html.replace(re, `$1${esc(content)}$2`);
  return html;
}

function setCanonical(html: string, url: string): string {
  return html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${esc(url)}" />`);
}

function setTitle(html: string, title: string): string {
  return html.replace(/<title[^>]*>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
}

export function communityUsername(pathname: string): string | null {
  const { path } = splitLocale(pathname);
  const norm = path.endsWith("/") ? path.slice(0, -1) : path;
  const parts = norm.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  const name = parts[0].toLowerCase();
  if (COMMUNITY_RESERVED_SEGMENTS.has(name)) return null;
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(name)) return null;
  return name;
}

function studioOrigin(hostname: string): string {
  if (hostname === COMMUNITY_STAGING_HOST) return "https://staging.twentyseven.pictures";
  return APEX;
}

/** 301 target, or null to SSR this request. */
export function communityRedirect(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const { locale, path } = splitLocale(url.pathname);
  const norm = path.endsWith("/") ? path : `${path}/`;
  const origin = url.origin;
  const studio = studioOrigin(url.hostname);
  if (norm === "/toons/" || path === "/toons") return `${origin}/`;
  if (path.startsWith("/toons/editor")) return `${studio}${url.pathname}${url.search}`;
  if (APEX_STUDIO_PREFIXES.some((p) => norm === p || path.startsWith(p))) {
    return `${studio}${url.pathname}${url.search}`;
  }
  if (locale !== "en" && (norm === "/" || path === "")) return `${origin}/`;
  if (locale !== "en" && path.startsWith("/toons/")) return `${origin}${norm}${url.search}`;
  return null;
}

export function applyCommunityHomeHtml(
  html: string,
  payload: CatalogPayload,
  requestUrl: string,
  editor?: string
): string {
  const url = new URL(requestUrl);
  const origin = url.origin;
  const slice = editor ? payloadForEditor(payload, editor) : payload;
  const locale = "en";
  const ui = UI[locale];
  const pagePath = editor ? `/${editor}/` : "/";
  const pageUrl = `${origin}${pagePath}`;
  const title = editor ? `${editor} — FlipFrame toons` : "FlipFrame | Interactive Toons";
  const lead = editor
    ? `Public FlipFrame toons by ${editor}.`
    : "FlipFrame interactive toons from independent editors — you read them rather than watch.";
  let out = html;
  out = setTitle(out, title);
  out = setCanonical(out, pageUrl);
  out = setMeta(out, "name", "description", lead);
  out = setMeta(out, "property", "og:url", pageUrl);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", lead);
  out = setMeta(out, "name", "twitter:title", title);
  out = setMeta(out, "name", "twitter:description", lead);
  out = replaceAttrText(out, "data-community-title", editor ? editor : "Interactive Toons");
  out = replaceAttrText(out, "data-community-lead", lead);
  out = out.replace(
    /<nav\b[^>]*\bpage-breadcrumb\b[^>]*>[\s\S]*?<\/nav>/,
    breadcrumbNavHtml(
      editor ? [{ href: "/", name: ui.toons }, { name: editor }] : toonTrail({ locale, community: true }),
      ui.breadcrumb
    )
  );
  out = fillEmptyDiv(out, "data-toon-catalog", landingGridHtml(slice, locale));
  if (html.includes("data-toon-jsonld")) {
    out = replaceScript(out, "data-toon-jsonld", catalogJsonLd(slice, { pageUrl, locale, origin }));
  }
  return out;
}
