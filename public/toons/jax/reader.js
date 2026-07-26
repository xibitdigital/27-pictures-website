/**
 * Jax toon reader helpers
 * - Multilingual word overlays at x/y design coordinates (Cabin Sketch)
 * - Coordinates: 0–1 fractions of design size, or absolute design pixels
 */
(function (global) {
  "use strict";

  const LANG_STORAGE_KEY = "jax-toon-lang";

  function clamp01(n) {
    return Math.max(0, Math.min(1, n));
  }

  /**
   * Normalize coordinate: if value > 1 treat as design pixels, else fraction.
   */
  function toFraction(value, designSize) {
    if (value == null || Number.isNaN(Number(value))) return 0;
    const n = Number(value);
    if (n > 1) return clamp01(n / designSize);
    return clamp01(n);
  }

  /**
   * Content box of an object-fit:contain image inside its offset parent slot.
   */
  function imageContentBox(img) {
    const nw = img.naturalWidth || 1;
    const nh = img.naturalHeight || 1;
    const cw = img.clientWidth;
    const ch = img.clientHeight;
    const scale = Math.min(cw / nw, ch / nh);
    const width = nw * scale;
    const height = nh * scale;
    const left = (cw - width) / 2;
    const top = (ch - height) / 2;
    return { left, top, width, height, scale };
  }

  function resolveText(entry, lang) {
    if (!entry) return "";
    if (typeof entry === "string") return entry;
    if (entry.text) {
      if (typeof entry.text === "string") return entry.text;
      return entry.text[lang] || entry.text.en || entry.text.it || "";
    }
    return entry[lang] || entry.en || entry.it || "";
  }

  /**
   * @typedef {Object} WordEntry
   * @property {string} [id]
   * @property {number} x - 0–1 fraction or design px
   * @property {number} y - 0–1 fraction or design px
   * @property {'left'|'center'|'right'} [align]
   * @property {number} [size] - design-pixel font size (scaled to display)
   * @property {string} [color]
   * @property {boolean} [shadow]
   * @property {number} [maxWidth] - 0–1 fraction of page width
   * @property {number} [rotate] - degrees
   * @property {Object|string} text - { en, it } or string
   */

  class WordOverlay {
    /**
     * @param {object} config from words.json
     */
    constructor(config) {
      this.designWidth = config.designWidth || 1008;
      this.designHeight = config.designHeight || 1792;
      this.pages = config.pages || {};
      this.languages = config.languages || [
        { code: "en", label: "EN" },
        { code: "it", label: "IT" },
      ];
      this.defaultLang = config.defaultLang || "en";
      this.fontFamily = config.fontFamily || '"Cabin Sketch", cursive';
      this.lang = this._readStoredLang() || this.defaultLang;
      this._observers = new WeakMap();
    }

    _readStoredLang() {
      try {
        const v = localStorage.getItem(LANG_STORAGE_KEY);
        if (v && this.languages.some((l) => l.code === v)) return v;
      } catch (_) {
        /* ignore */
      }
      return null;
    }

    _storeLang(code) {
      try {
        localStorage.setItem(LANG_STORAGE_KEY, code);
      } catch (_) {
        /* ignore */
      }
    }

    setLang(code) {
      if (!this.languages.some((l) => l.code === code)) return;
      this.lang = code;
      this._storeLang(code);
    }

    getLang() {
      return this.lang;
    }

    getLanguages() {
      return this.languages.slice();
    }

    wordsForPage(pageNum) {
      const key = String(pageNum);
      return this.pages[key] || this.pages[pageNum] || [];
    }

    /**
     * Render word layer into a page slot that already contains an <img>.
     * @param {HTMLElement} slot
     * @param {number|null} pageNum 1-based; null clears overlays
     */
    render(slot, pageNum) {
      if (!slot) return;
      slot.querySelectorAll(".jax-word-layer").forEach((n) => n.remove());

      if (pageNum == null) return;
      const img = slot.querySelector("img");
      if (!img) return;

      const words = this.wordsForPage(pageNum);
      if (!words.length) return;

      const layer = document.createElement("div");
      layer.className = "jax-word-layer";
      layer.setAttribute("aria-hidden", "true");
      slot.appendChild(layer);

      const paint = () => {
        if (!img.isConnected || !layer.isConnected) return;
        const box = imageContentBox(img);
        layer.style.cssText = [
          "position:absolute",
          `left:${box.left}px`,
          `top:${box.top}px`,
          `width:${box.width}px`,
          `height:${box.height}px`,
          "pointer-events:none",
          "overflow:visible",
          "z-index:4",
        ].join(";");

        layer.innerHTML = "";
        const designScale = box.width / this.designWidth;

        words.forEach((w) => {
          const text = resolveText(w, this.lang);
          if (!text) return;

          const x = toFraction(w.x, this.designWidth);
          const y = toFraction(w.y, this.designHeight);
          const align = w.align || "center";
          const sizePx = (w.size != null ? Number(w.size) : 22) * designScale;
          const maxW =
            w.maxWidth != null
              ? (w.maxWidth > 1 ? w.maxWidth / this.designWidth : w.maxWidth) * 100
              : null;

          const el = document.createElement("div");
          el.className = "jax-word";
          if (w.id) el.dataset.wordId = w.id;
          el.textContent = text;

          const transform = [];
          if (align === "center") transform.push("translate(-50%, -50%)");
          else if (align === "right") transform.push("translate(-100%, -50%)");
          else transform.push("translate(0, -50%)");
          if (w.rotate) transform.push(`rotate(${w.rotate}deg)`);

          el.style.cssText = [
            "position:absolute",
            `left:${x * 100}%`,
            `top:${y * 100}%`,
            `transform:${transform.join(" ")}`,
            `font-family:${this.fontFamily}`,
            `font-size:${Math.max(10, sizePx)}px`,
            "line-height:1.15",
            "font-weight:400",
            `color:${w.color || "#fff"}`,
            "white-space:pre-line",
            "text-align:" + (align === "right" ? "right" : align === "left" ? "left" : "center"),
            maxW != null ? `max-width:${maxW}%` : "",
            w.shadow !== false
              ? "text-shadow:0 1px 2px rgba(0,0,0,0.85),0 0 12px rgba(0,0,0,0.45)"
              : "",
            "letter-spacing:0.02em",
          ]
            .filter(Boolean)
            .join(";");

          layer.appendChild(el);
        });
      };

      if (img.complete && img.naturalWidth) paint();
      else img.addEventListener("load", paint, { once: true });

      // Reposition on resize / layout changes
      if (typeof ResizeObserver !== "undefined") {
        const prev = this._observers.get(slot);
        if (prev) prev.disconnect();
        const ro = new ResizeObserver(() => paint());
        ro.observe(slot);
        if (img) ro.observe(img);
        this._observers.set(slot, ro);
      }
    }

    /**
     * Re-render every slot that currently has a page image with data-page-num.
     */
    refreshAll(root) {
      const scope = root || document;
      scope.querySelectorAll(".page-slot[data-page-num]").forEach((slot) => {
        const n = Number(slot.dataset.pageNum);
        if (n) this.render(slot, n);
        else this.render(slot, null);
      });
    }
  }

  async function loadWords(url) {
    const res = await fetch(url || "words.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`words.json ${res.status}`);
    return res.json();
  }

  /**
   * Wire a simple EN/IT language switcher.
   * @param {HTMLElement} container
   * @param {WordOverlay} overlay
   * @param {() => void} onChange
   */
  function mountLangSwitcher(container, overlay, onChange) {
    if (!container) return;
    container.innerHTML = "";
    container.classList.add("jax-lang-switcher");
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", "Language");

    overlay.getLanguages().forEach((lang) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "jax-lang-btn";
      btn.textContent = lang.label || lang.code.toUpperCase();
      btn.dataset.lang = lang.code;
      btn.setAttribute("aria-pressed", String(lang.code === overlay.getLang()));
      if (lang.code === overlay.getLang()) btn.classList.add("is-active");
      btn.addEventListener("click", () => {
        overlay.setLang(lang.code);
        container.querySelectorAll(".jax-lang-btn").forEach((b) => {
          const active = b.dataset.lang === lang.code;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", String(active));
        });
        if (typeof onChange === "function") onChange(lang.code);
      });
      container.appendChild(btn);
    });
  }

  global.JaxToon = {
    WordOverlay,
    loadWords,
    mountLangSwitcher,
    imageContentBox,
    toFraction,
    LANG_STORAGE_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
