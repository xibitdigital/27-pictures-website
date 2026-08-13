/**
 * Click-to-play YouTube façades.
 *
 * Eight embeds on the homepage pulled ~1MB of YouTube JS each before anyone
 * pressed play, which is the page's Core Web Vitals problem. Each placeholder
 * renders a thumbnail plus a play button and only builds the real iframe on
 * activation — same markup contract as the old iframes, so the CSS around them
 * is unchanged.
 *
 * Markup: <div class="yt-facade" data-embed="<embed url>" data-poster="<id>"
 *              data-title="…"></div>
 */
const PARAMS = "autoplay=1&rel=0";

function buildIframe(embed: string, title: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  const join = embed.includes("?") ? "&" : "?";
  frame.src = `${embed}${join}${PARAMS}`;
  frame.title = title;
  frame.loading = "eager";
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  frame.setAttribute("frameborder", "0");
  return frame;
}

function mount(el: HTMLElement): void {
  const embed = el.dataset.embed;
  const poster = el.dataset.poster;
  const title = el.dataset.title || "27 Pictures video";
  if (!embed || el.dataset.ready === "1") return;
  el.dataset.ready = "1";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "yt-facade-btn";
  button.setAttribute("aria-label", `Play: ${title}`);

  if (poster) {
    const img = document.createElement("img");
    // maxres is missing on some uploads; hq720 is the safe fallback size.
    img.src = `https://i.ytimg.com/vi/${poster}/hq720.jpg`;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    button.appendChild(img);
  }

  const glyph = document.createElement("span");
  glyph.className = "yt-facade-play";
  glyph.setAttribute("aria-hidden", "true");
  button.appendChild(glyph);

  const label = document.createElement("span");
  label.className = "yt-facade-title";
  label.textContent = title;
  button.appendChild(label);

  button.addEventListener(
    "click",
    () => {
      el.replaceChildren(buildIframe(embed, title));
    },
    { once: true }
  );

  el.replaceChildren(button);
}

export function initYouTubeFacades(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(".yt-facade").forEach(mount);
}
