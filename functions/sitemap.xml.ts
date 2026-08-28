/**
 * Serve /sitemap.xml from the toon-editor Worker (D1) at the site origin.
 * Crawlers must see https://twentyseven.pictures/sitemap.xml, not the Worker host.
 */
const EDITOR = "https://toon-editor.sangalli-marco.workers.dev";

export const onRequest: PagesFunction = async (context) => {
  const origin = new URL(context.request.url).origin;
  const url = `${EDITOR}/sitemap.xml?site=${encodeURIComponent(origin)}`;
  const res = await fetch(url, { headers: { Accept: "application/xml" } });
  if (!res.ok) {
    return new Response("sitemap unavailable", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
