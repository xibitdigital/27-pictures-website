/**
 * Shared scroll / book view-mode toggle for 27 Pictures toon readers.
 *
 * Usage (same global style as book-reader.js):
 *   <script src="../view-mode.js?v=…"></script>
 *   <script>
 *     const viewMode = ToonViewMode.init({
 *       altPrefix: "Jax",
 *       onPagePaint(slot, pageNum) { … },   // optional (Jax captions)
 *       onEnterBook() { … },                // optional (refresh book overlays)
 *       onEnterScroll() { … },              // optional (refresh strip overlays)
 *       mobileDefault: true,                // scroll on max-width ≤ 768px
 *     });
 *   </script>
 *
 * Expected DOM ids (overridable via opts):
 *   viewModeBtn, viewModeLabel, verticalStrip
 *
 * Body class "view-vertical" while in scroll mode; CSS lives in reader-shared.css.
 */
(function (global) {
  "use strict";

  /** Same breakpoint as book-reader.js single-page mode. */
  const MOBILE_MAX_WIDTH = 768;

  /**
   * @param {object} [opts]
   * @param {string} [opts.altPrefix] - used in img alt text
   * @param {string} [opts.manifestUrl]
   * @param {string|HTMLElement} [opts.btn]
   * @param {string|HTMLElement} [opts.label]
   * @param {string|HTMLElement} [opts.strip]
   * @param {string} [opts.readerId] - element scrolled to top on enter (default main-content)
   * @param {boolean} [opts.mobileDefault=true] - start in scroll mode under MOBILE_MAX_WIDTH
   * @param {(slot: HTMLElement, pageNum: number) => void} [opts.onPagePaint]
   * @param {() => void} [opts.onEnterBook]
   * @param {(strip: HTMLElement) => void} [opts.onEnterScroll] - after strip is shown/built
   * @returns {{ isVertical: () => boolean, setVertical: (on: boolean) => Promise<void>, refreshStrip: () => void, getStrip: () => HTMLElement|null }}
   */
  function init(opts) {
    opts = opts || {};
    const altPrefix = opts.altPrefix || "Toon";
    const manifestUrl = opts.manifestUrl || "manifest.json";
    const readerId = opts.readerId || "main-content";
    const mobileDefault = opts.mobileDefault !== false;
    const onPagePaint = typeof opts.onPagePaint === "function" ? opts.onPagePaint : null;
    const onEnterBook = typeof opts.onEnterBook === "function" ? opts.onEnterBook : null;
    const onEnterScroll = typeof opts.onEnterScroll === "function" ? opts.onEnterScroll : null;

    const btn = resolveEl(opts.btn, "viewModeBtn");
    const label = resolveEl(opts.label, "viewModeLabel");
    const strip = resolveEl(opts.strip, "verticalStrip");
    if (!btn || !strip) {
      return {
        isVertical: () => false,
        setVertical: async () => {},
        refreshStrip: () => {},
        getStrip: () => null,
      };
    }

    let vertical = false;
    let verticalBuilt = false;

    async function buildVerticalStrip() {
      const res = await fetch(manifestUrl, { cache: "no-cache" });
      if (!res.ok) throw new Error("manifest " + res.status);
      const manifest = await res.json();
      const files = Array.isArray(manifest.files) ? manifest.files : [];
      strip.innerHTML = "";
      files.forEach((src, i) => {
        const pageNum = i + 1;
        const slot = document.createElement("div");
        slot.className = "vertical-page page-slot";
        slot.dataset.pageNum = String(pageNum);
        const img = document.createElement("img");
        img.src = src;
        img.alt = altPrefix + " — page " + pageNum;
        img.draggable = false;
        img.loading = pageNum > 2 ? "lazy" : "eager";
        slot.appendChild(img);
        strip.appendChild(slot);
        if (onPagePaint) onPagePaint(slot, pageNum);
      });
      verticalBuilt = true;
    }

    async function setVertical(on) {
      vertical = !!on;
      document.body.classList.toggle("view-vertical", vertical);
      btn.classList.toggle("is-active", vertical);
      btn.setAttribute("aria-pressed", String(vertical));

      if (vertical) {
        btn.title = "Switch to book view";
        btn.setAttribute("aria-label", btn.title);
        if (label) label.textContent = "Book";
        strip.hidden = false;
        if (!verticalBuilt) {
          try {
            await buildVerticalStrip();
          } catch (err) {
            console.error(err);
          }
        }
        const reader = document.getElementById(readerId);
        if (reader) reader.scrollTop = 0;
        window.scrollTo(0, 0);
        // Notify after build/show so late overlays (e.g. Jax words) can attach.
        // Pass strip so callers don't need the return value during init.
        if (onEnterScroll) onEnterScroll(strip);
      } else {
        btn.title = "Switch to vertical scroll view";
        btn.setAttribute("aria-label", btn.title);
        if (label) label.textContent = "Scroll";
        strip.hidden = true;
        if (onEnterBook) onEnterBook();
      }
    }

    function refreshStrip() {
      if (!vertical || !strip) return;
      if (onEnterScroll) onEnterScroll(strip);
    }

    btn.addEventListener("click", () => {
      setVertical(!vertical);
    });

    if (mobileDefault && prefersMobileScroll()) {
      setVertical(true);
    }

    return {
      isVertical: () => vertical,
      setVertical,
      refreshStrip,
      getStrip: () => strip,
    };
  }

  function prefersMobileScroll() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: " + MOBILE_MAX_WIDTH + "px)").matches
    );
  }

  function resolveEl(value, idFallback) {
    if (value && value.nodeType === 1) return value;
    if (typeof value === "string") return document.getElementById(value);
    return document.getElementById(idFallback);
  }

  global.ToonViewMode = {
    init,
    prefersMobileScroll,
    MOBILE_MAX_WIDTH,
  };
})(typeof window !== "undefined" ? window : globalThis);
