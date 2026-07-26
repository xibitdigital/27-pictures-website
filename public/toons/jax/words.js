/**
 * Jax caption overlays for ToonBook pages.
 * - Multilingual words at x/y design coordinates (Cabin Sketch)
 * - Coordinates: 0–1 fractions of design size, or absolute design pixels
 * - variant: "plain" (default) | "bubble" (sketchy dialog balloon)
 * Used with ../book-reader.js via ToonBook.init({ onPagePaint, … })
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

  /** Deterministic 0–1 PRNG from string/number seed */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(...parts) {
    let h = 2166136261;
    const s = parts.join("|");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /**
   * Sketchy rounded-rect path in viewBox units (0–100 x, 0–80 y) with optional tail.
   * @param {'none'|'bottom'|'bottom-left'|'bottom-right'|'left'|'right'} tail
   */
  function sketchyBubblePath(tail, seed) {
    const rnd = mulberry32(seed || 1);
    const j = (amp) => (rnd() - 0.5) * 2 * amp;

    // Wobbly points around a rounded bubble body
    const pts = [
      [12 + j(2), 18 + j(2)],
      [28 + j(2), 8 + j(1.5)],
      [50 + j(2), 6 + j(1.5)],
      [72 + j(2), 9 + j(1.5)],
      [88 + j(2), 18 + j(2)],
      [94 + j(1.5), 36 + j(2)],
      [92 + j(1.5), 54 + j(2)],
      [78 + j(2), 68 + j(1.5)],
      [55 + j(2), 72 + j(1.5)],
      [32 + j(2), 70 + j(1.5)],
      [14 + j(2), 58 + j(2)],
      [8 + j(1.5), 38 + j(2)],
    ];

    let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const mx = (prev[0] + cur[0]) / 2 + j(1.2);
      const my = (prev[1] + cur[1]) / 2 + j(1.2);
      d += ` Q ${mx.toFixed(2)} ${my.toFixed(2)} ${cur[0].toFixed(2)} ${cur[1].toFixed(2)}`;
    }
    // close body
    const last = pts[pts.length - 1];
    const first = pts[0];
    d += ` Q ${((last[0] + first[0]) / 2 + j(1)).toFixed(2)} ${((last[1] + first[1]) / 2 + j(1)).toFixed(2)} ${first[0].toFixed(2)} ${first[1].toFixed(2)} Z`;

    const t = tail || "bottom";
    if (t === "none") return d;

    // Sketchy speech tail
    if (t === "bottom" || t === "bottom-left" || t === "bottom-right") {
      const cx = t === "bottom-left" ? 32 : t === "bottom-right" ? 68 : 50;
      d += ` M ${(cx - 7 + j(1)).toFixed(2)} 68 Q ${(cx + j(2)).toFixed(2)} 78 ${(cx - 2 + j(2)).toFixed(2)} 92 L ${(cx + 8 + j(2)).toFixed(2)} 70 Z`;
    } else if (t === "left") {
      d += ` M 12 40 Q 4 48 -2 52 L 14 56 Z`;
    } else if (t === "right") {
      d += ` M 88 40 Q 96 48 102 52 L 86 56 Z`;
    }

    return d;
  }

  /**
   * Rough torn-paper rectangle path (viewBox 0-100 x 0-100) — no tail.
   * Used for "AI dialogue" caption boxes ("COMBAT MODE ACTIVATED" style).
   */
  function jaggedBoxPath(seed) {
    const rnd = mulberry32(seed || 1);
    const j = (amp) => (rnd() - 0.5) * 2 * amp;

    // Points per edge, wobbled off the straight line — hand-brushed, not ruled
    function edge(x0, y0, x1, y1, amp, segments) {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        let x = x0 + (x1 - x0) * t;
        let y = y0 + (y1 - y0) * t;
        if (i > 0 && i < segments) {
          x += j(amp);
          y += j(amp);
        }
        pts.push([x, y]);
      }
      return pts;
    }

    const tl = [4 + j(3), 6 + j(3)];
    const tr = [96 + j(3), 6 + j(3)];
    const br = [96 + j(3), 94 + j(3)];
    const bl = [4 + j(3), 94 + j(3)];

    const pts = [
      ...edge(tl[0], tl[1], tr[0], tr[1], 3.5, 6),
      ...edge(tr[0], tr[1], br[0], br[1], 3.5, 6).slice(1),
      ...edge(br[0], br[1], bl[0], bl[1], 3.5, 6).slice(1),
      ...edge(bl[0], bl[1], tl[0], tl[1], 3.5, 6).slice(1),
    ];

    // Sketchy pass: connect wobbled points with slightly bowed curves instead of
    // ruler-straight lines, so each edge reads as a rough hand-drawn stroke.
    let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const mx = (prev[0] + cur[0]) / 2 + j(1.4);
      const my = (prev[1] + cur[1]) / 2 + j(1.4);
      d += ` Q ${mx.toFixed(2)} ${my.toFixed(2)} ${cur[0].toFixed(2)} ${cur[1].toFixed(2)}`;
    }
    d += " Z";
    return d;
  }

  /**
   * Short overshooting scratch strokes fired outward from the box perimeter —
   * the crosshatched marker spikes around a hand-scrawled panel caption.
   */
  function scribbleScratches(seed, count) {
    const rnd = mulberry32(seed || 1);
    const bounds = { x0: 4, y0: 6, x1: 96, y1: 94 };
    const scratches = [];

    for (let i = 0; i < count; i++) {
      const edgeIdx = Math.floor(rnd() * 4);
      const t = 0.06 + rnd() * 0.88;
      let x, y, nx, ny;
      if (edgeIdx === 0) {
        x = bounds.x0 + (bounds.x1 - bounds.x0) * t;
        y = bounds.y0;
        nx = 0;
        ny = -1;
      } else if (edgeIdx === 1) {
        x = bounds.x1;
        y = bounds.y0 + (bounds.y1 - bounds.y0) * t;
        nx = 1;
        ny = 0;
      } else if (edgeIdx === 2) {
        x = bounds.x0 + (bounds.x1 - bounds.x0) * t;
        y = bounds.y1;
        nx = 0;
        ny = 1;
      } else {
        x = bounds.x0;
        y = bounds.y0 + (bounds.y1 - bounds.y0) * t;
        nx = -1;
        ny = 0;
      }

      const angle = Math.atan2(ny, nx) + (rnd() - 0.5) * 1.7;
      const len = 6 + rnd() * 14;
      const wobble = () => (rnd() - 0.5) * 3;

      const sx = x - nx * (3 + rnd() * 5);
      const sy = y - ny * (3 + rnd() * 5);
      const mx = x + Math.cos(angle) * len * 0.5 + wobble();
      const my = y + Math.sin(angle) * len * 0.5 + wobble();
      const ex = x + Math.cos(angle) * len + wobble();
      const ey = y + Math.sin(angle) * len + wobble();

      scratches.push(
        `M ${sx.toFixed(2)} ${sy.toFixed(2)} L ${mx.toFixed(2)} ${my.toFixed(2)} L ${ex.toFixed(2)} ${ey.toFixed(2)}`
      );
    }
    return scratches;
  }

  const CAN_HOVER =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /** Play a word's SFX clip. Fresh Audio() per play so rapid re-triggers overlap. */
  function playSfx(url) {
    if (typeof window !== "undefined" && window.__jaxSoundEnabled === false) return;
    try {
      const audio = new Audio(url);
      audio.play().catch(() => {});
    } catch (_) {
      /* ignore */
    }
  }

  function resolveVariant(w) {
    const v = (w.variant || w.mode || "plain").toString().toLowerCase();
    if (v === "ai" || v === "hud" || v === "terminal" || v === "shout" || v === "caption") return "ai";
    if (v === "bubble" || v === "dialog" || v === "speech") return "bubble";
    return "plain";
  }

  function resolveBubbleStyle(w, variant) {
    const b = w.bubble && typeof w.bubble === "object" ? w.bubble : {};
    const isAi = variant === "ai";
    return {
      shape: b.shape || w.bubbleShape || (isAi ? "box" : "organic"),
      fill: b.fill || w.bubbleFill || (isAi ? "#0a0a0a" : "#fffef6"),
      stroke: b.stroke || w.bubbleStroke || (isAi ? "#0a0a0a" : "#111111"),
      strokeWidth:
        b.strokeWidth != null
          ? Number(b.strokeWidth)
          : w.bubbleStrokeWidth != null
            ? Number(w.bubbleStrokeWidth)
            : isAi
              ? 2.2
              : 2.4,
      tail: b.tail || w.tail || (isAi ? "none" : "bottom"),
      padX: b.padX != null ? Number(b.padX) : isAi ? 0.7 : 0.55,
      padY: b.padY != null ? Number(b.padY) : isAi ? 0.5 : 0.4,
    };
  }

  function createBubbleChrome(seed, bubbleStyle, designScale) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "jax-bubble-svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      bubbleStyle.shape === "box" ? jaggedBoxPath(seed) : sketchyBubblePath(bubbleStyle.tail, seed)
    );
    path.setAttribute("fill", bubbleStyle.fill);
    path.setAttribute("stroke", bubbleStyle.stroke);
    const sw = Math.max(1.2, (bubbleStyle.strokeWidth || 2.4) * Math.min(1.4, designScale * 1.1));
    path.setAttribute("stroke-width", String(sw));
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(path);

    if (bubbleStyle.shape === "box") {
      // Second + third rough passes, unfilled — a hand re-tracing the marker
      // outline instead of one clean stroke, like the reference caption box.
      [97, 211].forEach((offset, i) => {
        const retrace = document.createElementNS("http://www.w3.org/2000/svg", "path");
        retrace.setAttribute("d", jaggedBoxPath((seed || 1) + offset));
        retrace.setAttribute("fill", "none");
        retrace.setAttribute("stroke", bubbleStyle.stroke);
        retrace.setAttribute("stroke-width", String(Math.max(0.8, sw * (0.65 - i * 0.15))));
        retrace.setAttribute("stroke-linejoin", "round");
        retrace.setAttribute("stroke-linecap", "round");
        retrace.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(retrace);
      });

      // Crosshatched scratch spikes shooting past the border, like a marker
      // that overshot while scrawling the frame.
      scribbleScratches((seed || 1) + 401, 10).forEach((d, i) => {
        const scratch = document.createElementNS("http://www.w3.org/2000/svg", "path");
        scratch.setAttribute("d", d);
        scratch.setAttribute("fill", "none");
        scratch.setAttribute("stroke", bubbleStyle.stroke);
        scratch.setAttribute("stroke-width", String(Math.max(0.9, sw * (0.4 + (i % 3) * 0.18))));
        scratch.setAttribute("stroke-linecap", "round");
        scratch.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(scratch);
      });
    }

    return svg;
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
      return entry.text[lang] || entry.text.en || entry.text.it || entry.text.de || entry.text.fr || "";
    }
    return entry[lang] || entry.en || entry.it || entry.de || entry.fr || "";
  }

  /**
   * Resolve stroke options from a word entry.
   * Accepts:
   *   stroke: "#000", strokeThickness: 2
   *   strokeColor / strokeWidth (aliases)
   *   stroke: { color: "#000", thickness: 2 }  // or width
   * Thickness is in design pixels (scaled to display).
   * @returns {{ color: string, thickness: number }|null}
   */
  function resolveStroke(w) {
    if (!w) return null;
    let color = w.strokeColor || null;
    let thickness = w.strokeThickness != null ? Number(w.strokeThickness) : null;

    if (w.strokeWidth != null && thickness == null) thickness = Number(w.strokeWidth);

    if (w.stroke != null) {
      if (typeof w.stroke === "string") {
        color = color || w.stroke;
      } else if (typeof w.stroke === "object") {
        color = color || w.stroke.color || w.stroke.strokeColor || null;
        if (thickness == null) {
          const t = w.stroke.thickness != null ? w.stroke.thickness : w.stroke.width;
          if (t != null) thickness = Number(t);
        }
      }
    }

    if (!color || thickness == null || Number.isNaN(thickness) || thickness <= 0) {
      // If only color is set, use a small default thickness; if only thickness, default black
      if (color && (thickness == null || Number.isNaN(thickness))) thickness = 1.5;
      else if (thickness > 0 && !color) color = "#000000";
      else return null;
    }

    return { color, thickness };
  }

  /**
   * @typedef {Object} WordEntry
   * @property {number} x - 0–1 fraction or design px
   * @property {number} y - 0–1 fraction or design px
   * @property {'left'|'center'|'right'} [align]
   * @property {number} [size] - design-pixel font size (scaled to display)
   * @property {string} [color] - fill color
   * @property {string|Object} [stroke] - outline color string, or { color, thickness|width }
   * @property {string} [strokeColor] - outline color
   * @property {number} [strokeThickness] - outline width in design px
   * @property {number} [strokeWidth] - alias of strokeThickness
   * @property {number} [maxWidth] - 0–1 fraction of page width
   * @property {number} [angle] - rotation in degrees (clockwise positive)
   * @property {number} [rotate] - alias of angle
   * @property {'plain'|'bubble'} [variant] - "bubble" = sketchy dialog balloon
   * @property {'plain'|'bubble'} [mode] - alias of variant
   * @property {string} [tail] - bubble tail: none|bottom|bottom-left|bottom-right|left|right
   * @property {Object} [bubble] - { fill, stroke, strokeWidth, tail, padX, padY }
   * @property {Object|string} text - { en, it, de, fr } or string
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
        { code: "de", label: "DE" },
        { code: "fr", label: "FR" },
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
          // Above .nav-zone (z-index:30, covers the full page for turn
          // clicks) so word hover/click targets actually receive events.
          "z-index:35",
        ].join(";");

        layer.innerHTML = "";
        const designScale = box.width / this.designWidth;

        words.forEach((w, wordIndex) => {
          const text = resolveText(w, this.lang);
          if (!text) return;

          const x = toFraction(w.x, this.designWidth);
          const y = toFraction(w.y, this.designHeight);
          const align = w.align || "center";
          const sizePx = (w.size != null ? Number(w.size) : 22) * designScale;
          const maxW = w.maxWidth != null ? (w.maxWidth > 1 ? w.maxWidth / this.designWidth : w.maxWidth) * 100 : null;
          const variant = resolveVariant(w);
          const isBubble = variant === "bubble" || variant === "ai";

          const el = document.createElement("div");
          el.className = isBubble
            ? "jax-word jax-word--bubble" + (variant === "ai" ? " jax-word--ai" : "")
            : "jax-word";

          const textEl = document.createElement("span");
          textEl.className = "jax-word-text";
          textEl.textContent = text;

          if (isBubble) {
            const bubbleStyle = resolveBubbleStyle(w, variant);
            const seed = hashSeed(pageNum, wordIndex, text, w.x, w.y, bubbleStyle.tail);
            el.appendChild(createBubbleChrome(seed, bubbleStyle, designScale));
            el.appendChild(textEl);
            el.dataset.tail = bubbleStyle.tail;
            // Bubble text defaults to dark ink; AI caption boxes default to white
            textEl.style.color = w.color || (variant === "ai" ? "#f5f5f5" : "#111111");
            const padX = `${bubbleStyle.padX}em`;
            const padY = `${bubbleStyle.padY}em`;
            textEl.style.padding = `${padY} ${padX} ${bubbleStyle.tail === "none" ? padY : `calc(${padY} + 0.35em)`} ${padX}`;
          } else {
            el.appendChild(textEl);
          }

          const transform = [];
          if (align === "center") transform.push("translate(-50%, -50%)");
          else if (align === "right") transform.push("translate(-100%, -50%)");
          else transform.push("translate(0, -50%)");
          const angle = w.angle != null ? Number(w.angle) : w.rotate != null ? Number(w.rotate) : 0;
          if (angle && !Number.isNaN(angle)) transform.push(`rotate(${angle}deg)`);

          const stroke = resolveStroke(w);
          const strokeCss = [];
          // Text stroke applies to the text span (bubbles often skip heavy text stroke)
          if (stroke && !isBubble) {
            const strokePx = Math.max(0.5, stroke.thickness * designScale);
            strokeCss.push(`-webkit-text-stroke:${strokePx}px ${stroke.color}`);
            strokeCss.push(`paint-order:stroke fill`);
            strokeCss.push(`text-stroke:${strokePx}px ${stroke.color}`);
          } else if (stroke && isBubble) {
            const strokePx = Math.max(0.4, stroke.thickness * designScale * 0.65);
            textEl.style.webkitTextStroke = `${strokePx}px ${stroke.color}`;
            textEl.style.paintOrder = "stroke fill";
          }

          const textAlign = align === "right" ? "right" : align === "left" ? "left" : "center";

          el.style.cssText = [
            "position:absolute",
            `left:${x * 100}%`,
            `top:${y * 100}%`,
            `transform:${transform.join(" ")}`,
            `font-family:${this.fontFamily}`,
            `font-size:${Math.max(10, sizePx)}px`,
            "line-height:1.15",
            "font-weight:700",
            isBubble ? "" : `color:${w.color || "#fff"}`,
            "white-space:pre-line",
            "text-align:" + textAlign,
            maxW != null ? `max-width:${maxW}%` : "",
            ...strokeCss,
            "letter-spacing:0.02em",
            w.audio ? "pointer-events:auto" : "",
            w.audio ? "cursor:pointer" : "",
          ]
            .filter(Boolean)
            .join(";");

          if (!isBubble) {
            textEl.style.cssText = strokeCss.concat([`color:${w.color || "#fff"}`]).join(";");
          }

          if (w.audio) {
            const play = (ev) => {
              ev.stopPropagation();
              playSfx(w.audio);
            };
            // Desktop mouse: play on hover. Touch (no hover): play on tap.
            if (CAN_HOVER) el.addEventListener("mouseenter", play);
            el.addEventListener("click", play);
          }

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
   * Wire language switcher buttons (EN/IT/DE/FR by default).
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
