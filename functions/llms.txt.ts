/**
 * /llms.txt at the site origin — static films/services plus D1 toon hubs and readers.
 */
import { loadCatalogForOrigin } from "./toonSsr";
import { renderLlmsTxt } from "../src/site/crawlerDocs";

export const onRequest: PagesFunction = async (context) => {
  const origin = new URL(context.request.url).origin;
  const payload = await loadCatalogForOrigin(origin);
  if (!payload) {
    return new Response("llms.txt unavailable", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(renderLlmsTxt(origin, payload), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
