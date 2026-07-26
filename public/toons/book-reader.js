/**
 * Shared page-turning book reader for 27 Pictures toons (Erin, Jax, …).
 *
 * Usage:
 *   <script src="../book-reader.js"></script>
 *   <script>
 *     ToonBook.init({
 *       altPrefix: "Erin",
 *       onPagePaint(slot, pageNum) { ... },  // optional (Jax captions)
 *       onPageClear(slot) { ... },
 *       afterFullscreen() { ... },
 *       beforeStart() { return Promise },    // optional async setup
 *     });
 *   </script>
 *
 * Expected DOM ids: book, slot-left, slot-right, indicator,
 * btn-prev, btn-next, zone-next, zone-prev, fullscreenBtn (optional).
 * Body class "single-page" toggled under 768px.
 */
(function (global) {
  "use strict";

  const FLIP_MS = 700;
  const FLIP_SAFETY_MS = FLIP_MS + 200;
  const SINGLE_FLIP_MS = 350;

  /**
   * @param {object} [opts]
   * @param {string} [opts.altPrefix]
   * @param {string} [opts.manifestUrl]
   * @param {string} [opts.backHref]
   * @param {string} [opts.backLabel]
   * @param {string} [opts.fsLabelSelector] - .toon-fs-label
   * @param {string} [opts.frontCoverLogo] - image src shown above "How to read"
   * @param {string} [opts.soundHint] - if set, adds a real "Turn the sound on"
   *   button (class .front-cover-sound-btn, this string as its label) below
   *   the front-cover instructions list. The page's own script must wire up
   *   its click behavior (e.g. via event delegation, since this button is
   *   recreated whenever the front cover re-renders).
   * @param {(slot: HTMLElement, pageNum: number) => void} [opts.onPagePaint]
   * @param {(slot: HTMLElement) => void} [opts.onPageClear]
   * @param {() => void} [opts.afterFullscreen]
   * @param {() => void|Promise<void>} [opts.beforeStart]
   */
  function init(opts) {
    opts = opts || {};
    const altPrefix = opts.altPrefix || "Page";
    const manifestUrl = opts.manifestUrl || "manifest.json";
    const backHref = opts.backHref || "/experiments/";
    const backLabel = opts.backLabel || "← experiments";
    const fsLabelSelector = opts.fsLabelSelector || ".toon-fs-label";
    const onPagePaint = typeof opts.onPagePaint === "function" ? opts.onPagePaint : null;
    const onPageClear = typeof opts.onPageClear === "function" ? opts.onPageClear : null;
    const afterFullscreen = typeof opts.afterFullscreen === "function" ? opts.afterFullscreen : null;
    const beforeStart = typeof opts.beforeStart === "function" ? opts.beforeStart : null;
    const frontCoverLogo = opts.frontCoverLogo || null;
    const soundHint = opts.soundHint || null;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const singlePageMq = window.matchMedia("(max-width: 768px)");

    let pages = [];
    let totalSpreads = 0;
    let viewIndex = 0;
    let singlePage = singlePageMq.matches;
    let isFlipping = false;
    let flipSafetyTimer = null;

    document.body.classList.toggle("single-page", singlePage);

    const slotLeft = document.getElementById("slot-left");
    const slotRight = document.getElementById("slot-right");
    const indicator = document.getElementById("indicator");
    const btnPrev = document.getElementById("btn-prev");
    const btnNext = document.getElementById("btn-next");
    const zoneNext = document.getElementById("zone-next");
    const zonePrev = document.getElementById("zone-prev");
    const bookEl = document.getElementById("book");

    if (!bookEl || !slotLeft || !slotRight || !indicator || !btnPrev || !btnNext) {
      console.error("ToonBook: missing required DOM nodes");
      return;
    }

    function totalViews() {
      // +2 = front-cover view + back-cover view around the pages themselves.
      if (singlePage) return pages.length + 2;
      return totalSpreads;
    }

    async function loadPages() {
      const res = await fetch(manifestUrl, { cache: "no-cache" });
      if (!res.ok) throw new Error(`manifest.json ${res.status}`);
      const manifest = await res.json();
      if (Array.isArray(manifest.files) && manifest.files.length) {
        return manifest.files.map((f) => String(f));
      }
      const count = Number(manifest.pages) || 0;
      const pattern = manifest.pattern || "assets/{n}.jpg";
      if (count < 1) return [];
      return Array.from({ length: count }, (_, i) => pattern.replace("{n}", String(i + 1)));
    }

    function pageIndexForSpread(spread, side) {
      if (spread === 0 && side === "left") return null;
      return side === "left" ? 2 * spread - 1 : 2 * spread;
    }

    function pageForSpread(spread, side) {
      const idx = pageIndexForSpread(spread, side);
      if (idx === null || idx >= pages.length) return null;
      return pages[idx];
    }

    function pageNumber(spread, side) {
      const idx = pageIndexForSpread(spread, side);
      if (idx === null || idx >= pages.length) return null;
      return idx + 1;
    }

    function isFrontCover(spread, side) {
      return spread === 0 && side === "left";
    }

    function isBackCover(spread, side) {
      return spread === totalSpreads - 1 && !pageForSpread(spread, side);
    }

    function singleViewContent(index) {
      // index 0 = front cover (how-to-read instructions), same as desktop's
      // spread 0 pairing a front cover with page 1 — mobile just shows them
      // as separate swipeable views instead of side by side.
      if (index === 0) return { kind: "front" };
      const pageIndex = index - 1;
      if (pageIndex >= pages.length) return { kind: "back" };
      return { kind: "page", src: pages[pageIndex], num: pageIndex + 1 };
    }

    function renderFrontCoverInstructions() {
      const wrap = document.createElement("div");
      wrap.className = "front-cover-instructions";
      wrap.innerHTML = `
        <p class="front-cover-brand">FlipFrame<span>by twentyseven.pictures</span></p>
        ${frontCoverLogo ? `<img class="front-cover-logo" src="${frontCoverLogo}" alt="${altPrefix} logo" />` : ""}
        <h2>How to read</h2>
        <ul>
          <li>Click or tap the right page<span>next page</span></li>
          <li>Click or tap the left page<span>previous page</span></li>
          <li>Use the arrow buttons below<span>← previous · → next</span></li>
          <li>Keyboard arrow keys<span>← previous · → next</span></li>
          <li>Swipe on touch devices<span>left = next · right = previous</span></li>
        </ul>
        ${
          soundHint
            ? `<button type="button" class="toon-fs-btn front-cover-sound-btn" aria-pressed="false" title="Enable sound">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M4 9v6h4l5 4V5L8 9H4z" stroke-linecap="round" stroke-linejoin="round" />
                  <path class="front-cover-sound-waves" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>${soundHint}</span>
              </button>
              <p class="front-cover-sound-note">Hover (or tap) glowing captions on any page to hear them</p>`
            : ""
        }
      `;
      return wrap;
    }

    /**
     * @param {HTMLElement} parent
     * @param {string} src
     * @param {number|null} pageNum
     * @param {{ paint?: boolean }} [options] paint=false skips caption hooks (flip faces)
     */
    function appendPageImage(parent, src, pageNum, options) {
      const paint = !options || options.paint !== false;
      const img = document.createElement("img");
      img.src = src;
      img.alt = pageNum ? `${altPrefix} — page ${pageNum}` : `${altPrefix} page`;
      img.draggable = false;
      parent.appendChild(img);
      if (pageNum != null) {
        parent.dataset.pageNum = String(pageNum);
        if (paint && onPagePaint) onPagePaint(parent, pageNum);
      } else {
        delete parent.dataset.pageNum;
        if (paint && onPageClear) onPageClear(parent);
      }
    }

    function renderBackCoverLink(slot) {
      delete slot.dataset.pageNum;
      if (onPageClear) onPageClear(slot);
      const link = document.createElement("a");
      link.href = backHref;
      link.textContent = backLabel;
      link.className = "back-cover-link";
      slot.appendChild(link);
    }

    function renderSlot(slot, src, isInsideCover, spread, side) {
      slot.innerHTML = "";
      slot.classList.toggle("blank", !src && !isInsideCover);
      slot.classList.toggle("inside-cover", !src && isInsideCover);
      if (src) {
        appendPageImage(slot, src, pageNumber(spread, side));
      } else {
        delete slot.dataset.pageNum;
        if (onPageClear) onPageClear(slot);
        if (isInsideCover && isFrontCover(spread, side)) {
          slot.appendChild(renderFrontCoverInstructions());
        } else if (isInsideCover && isBackCover(spread, side)) {
          renderBackCoverLink(slot);
        }
      }
    }

    function renderSingleSlot(content) {
      const slot = slotRight;
      slot.innerHTML = "";
      slot.classList.remove("blank");
      slot.classList.toggle("inside-cover", content.kind !== "page");
      if (content.kind === "page") {
        appendPageImage(slot, content.src, content.num);
      } else if (content.kind === "front") {
        delete slot.dataset.pageNum;
        if (onPageClear) onPageClear(slot);
        slot.appendChild(renderFrontCoverInstructions());
      } else {
        renderBackCoverLink(slot);
      }
    }

    function updateIndicator() {
      const total = pages.length;
      if (singlePage) {
        const content = singleViewContent(viewIndex);
        if (content.kind === "page") {
          indicator.textContent = `${content.num} / ${total}`;
        } else if (content.kind === "front") {
          indicator.textContent = `Cover`;
        } else {
          indicator.textContent = `End`;
        }
        btnPrev.disabled = viewIndex <= 0;
        btnNext.disabled = viewIndex >= totalViews() - 1;
        return;
      }

      const rightNum = pageNumber(viewIndex, "right");
      const leftNum = pageNumber(viewIndex, "left");
      if (leftNum && rightNum) {
        indicator.textContent = `${leftNum} – ${rightNum} / ${total}`;
      } else if (rightNum) {
        indicator.textContent = `${rightNum} / ${total}`;
      } else if (leftNum) {
        indicator.textContent = `${leftNum} / ${total}`;
      } else {
        indicator.textContent = `0 / ${total}`;
      }
      btnPrev.disabled = viewIndex <= 0;
      btnNext.disabled = viewIndex >= totalSpreads - 1;
    }

    function updateView(skipRender) {
      document.body.classList.toggle("single-page", singlePage);
      if (singlePage) {
        if (!skipRender) renderSingleSlot(singleViewContent(viewIndex));
        updateIndicator();
        return;
      }
      const rightSrc = pageForSpread(viewIndex, "right");
      const leftSrc = pageForSpread(viewIndex, "left");
      if (!skipRender) {
        renderSlot(slotRight, rightSrc, !rightSrc, viewIndex, "right");
        renderSlot(slotLeft, leftSrc, !leftSrc, viewIndex, "left");
      }
      updateIndicator();
    }

    function createFlipFaceImage(src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.draggable = false;
      return img;
    }

    function createFlipOverlay(direction, frontSrc, backSrc) {
      const flip = document.createElement("div");
      flip.className = `flip-page ${direction === "next" ? "from-right" : "from-left"}`;

      const front = document.createElement("div");
      front.className = "flip-face front";
      if (frontSrc) front.appendChild(createFlipFaceImage(frontSrc));

      const back = document.createElement("div");
      back.className = "flip-face back";
      if (backSrc) back.appendChild(createFlipFaceImage(backSrc));
      else back.classList.add("inside-cover");

      flip.appendChild(front);
      flip.appendChild(back);
      bookEl.appendChild(flip);

      if (!reduceMotion) {
        requestAnimationFrame(() => flip.classList.add("flipping"));
      }
      return flip;
    }

    function createSingleFlipOverlay(direction, content) {
      const flip = document.createElement("div");
      flip.className = `flip-page ${direction === "next" ? "from-right" : "from-left"}`;
      const face = document.createElement("div");
      face.className = "flip-face front";
      if (content.kind === "page") {
        face.appendChild(createFlipFaceImage(content.src));
      } else if (content.kind === "front") {
        face.classList.add("inside-cover");
        face.appendChild(renderFrontCoverInstructions());
      } else {
        face.classList.add("inside-cover");
        const link = document.createElement("a");
        link.href = backHref;
        link.textContent = backLabel;
        link.className = "back-cover-link";
        face.appendChild(link);
      }
      flip.appendChild(face);
      bookEl.appendChild(flip);
      if (!reduceMotion) {
        requestAnimationFrame(() => flip.classList.add("flipping"));
      }
      return flip;
    }

    function finishFlip(flip, target, afterRender) {
      if (!isFlipping || !flip.isConnected) return;
      if (flipSafetyTimer) {
        clearTimeout(flipSafetyTimer);
        flipSafetyTimer = null;
      }
      afterRender();
      flip.remove();
      viewIndex = target;
      updateView(true);
      isFlipping = false;
    }

    function turnDesktop(delta) {
      const target = viewIndex + delta;
      if (target < 0 || target >= totalSpreads) return;

      const goingNext = delta > 0;
      const curRight = pageForSpread(viewIndex, "right");
      const curLeft = pageForSpread(viewIndex, "left");
      const nextRight = pageForSpread(target, "right");
      const nextLeft = pageForSpread(target, "left");

      if (reduceMotion) {
        viewIndex = target;
        updateView(false);
        return;
      }

      isFlipping = true;
      const frontSrc = goingNext ? curRight : curLeft;
      const backSrc = goingNext ? nextLeft : nextRight;
      const earlySlot = goingNext ? slotRight : slotLeft;
      const earlySrc = goingNext ? nextRight : nextLeft;
      const lateSlot = goingNext ? slotLeft : slotRight;
      const lateSrc = goingNext ? nextLeft : nextRight;

      const flip = createFlipOverlay(goingNext ? "next" : "prev", frontSrc, backSrc);
      renderSlot(earlySlot, earlySrc, !earlySrc, target, goingNext ? "right" : "left");

      const complete = () =>
        finishFlip(flip, target, () => {
          renderSlot(lateSlot, lateSrc, !lateSrc, target, lateSlot === slotLeft ? "left" : "right");
        });
      flip.addEventListener("animationend", complete, { once: true });
      flipSafetyTimer = setTimeout(complete, FLIP_SAFETY_MS);
    }

    function turnSingle(delta) {
      const target = viewIndex + delta;
      if (target < 0 || target >= totalViews()) return;

      if (reduceMotion) {
        viewIndex = target;
        updateView(false);
        return;
      }

      isFlipping = true;
      const leaving = singleViewContent(viewIndex);
      const arriving = singleViewContent(target);
      renderSingleSlot(arriving);

      const flip = createSingleFlipOverlay(delta > 0 ? "next" : "prev", leaving);
      const complete = () => finishFlip(flip, target, () => {});
      flip.addEventListener("animationend", complete, { once: true });
      flipSafetyTimer = setTimeout(complete, SINGLE_FLIP_MS + 150);
    }

    function turn(delta) {
      if (isFlipping) return;
      if (singlePage) turnSingle(delta);
      else turnDesktop(delta);
    }

    function spreadToSingle(spread) {
      // Single-page index N (N>=1) is page N; index 0 is the front cover;
      // pages.length+1 is the back cover — matches singleViewContent().
      const rightNum = pageNumber(spread, "right");
      const leftNum = pageNumber(spread, "left");
      if (rightNum) return rightNum;
      if (leftNum) return leftNum;
      if (spread <= 0) return 0;
      return pages.length + 1;
    }

    function singleToSpread(index) {
      if (index <= 0) return 0;
      if (index > pages.length) return Math.max(0, totalSpreads - 1);
      return Math.floor(index / 2);
    }

    function applyMode(nextSingle) {
      if (nextSingle === singlePage) return;
      if (isFlipping) {
        if (flipSafetyTimer) clearTimeout(flipSafetyTimer);
        flipSafetyTimer = null;
        bookEl.querySelectorAll(".flip-page").forEach((el) => el.remove());
        isFlipping = false;
      }
      if (nextSingle) viewIndex = spreadToSingle(viewIndex);
      else viewIndex = singleToSpread(viewIndex);
      singlePage = nextSingle;
      updateView(false);
    }

    const goNext = () => turn(1);
    const goPrev = () => turn(-1);

    if (zoneNext) zoneNext.addEventListener("click", goNext);
    if (zonePrev) zonePrev.addEventListener("click", goPrev);
    btnPrev.addEventListener("click", goPrev);
    btnNext.addEventListener("click", goNext);

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    });

    let touchStartX = 0;
    bookEl.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.touches[0].clientX;
      },
      { passive: true }
    );
    bookEl.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 40) return;
        if (dx > 0) goPrev();
        else goNext();
      },
      { passive: true }
    );

    if (typeof singlePageMq.addEventListener === "function") {
      singlePageMq.addEventListener("change", (e) => applyMode(e.matches));
    } else {
      singlePageMq.addListener((e) => applyMode(e.matches));
    }

    function isFullscreen() {
      return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
    }

    function updateFullscreenButton() {
      const btn = document.getElementById("fullscreenBtn");
      if (!btn) return;
      const on = isFullscreen();
      document.body.classList.toggle("is-fullscreen", on);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", on ? "Exit fullscreen" : "Enter fullscreen");
      btn.title = on ? "Exit fullscreen" : "Fullscreen";
      const label = btn.querySelector(fsLabelSelector);
      if (label) label.textContent = on ? "Exit" : "Full";
      const path = btn.querySelector("svg path");
      if (path) {
        path.setAttribute(
          "d",
          on
            ? "M8 8H3V3M16 8h5V3M8 16H3v5M16 16h5v5"
            : "M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"
        );
      }
      if (afterFullscreen) afterFullscreen();
    }

    async function toggleFullscreen() {
      try {
        if (isFullscreen()) {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          else if (document.msExitFullscreen) document.msExitFullscreen();
        } else {
          const el = document.documentElement;
          if (el.requestFullscreen) await el.requestFullscreen();
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
          else if (el.msRequestFullscreen) el.msRequestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen not available:", err);
      }
    }

    function mountFullscreenButton() {
      const btn = document.getElementById("fullscreenBtn");
      if (!btn) return;
      if (
        !document.documentElement.requestFullscreen &&
        !document.documentElement.webkitRequestFullscreen &&
        !document.documentElement.msRequestFullscreen
      ) {
        btn.hidden = true;
        return;
      }
      btn.addEventListener("click", toggleFullscreen);
      document.addEventListener("fullscreenchange", updateFullscreenButton);
      document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
      updateFullscreenButton();
    }

    async function start() {
      try {
        pages = await loadPages();
      } catch (err) {
        console.error(err);
        indicator.textContent = "Failed to load";
        btnPrev.disabled = true;
        btnNext.disabled = true;
        return;
      }

      if (!pages.length) {
        indicator.textContent = "No pages found";
        btnPrev.disabled = true;
        btnNext.disabled = true;
        return;
      }

      if (beforeStart) {
        try {
          await beforeStart();
        } catch (err) {
          console.warn("ToonBook beforeStart:", err);
        }
      }

      mountFullscreenButton();

      totalSpreads = Math.ceil((pages.length + 1) / 2);
      pages.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
      viewIndex = 0;
      document.body.classList.toggle("single-page", singlePage);
      updateView(false);
    }

    start();

    return {
      turn,
      goNext,
      goPrev,
      updateView,
      getViewIndex: () => viewIndex,
      getPages: () => pages.slice(),
    };
  }

  global.ToonBook = { init };
})(typeof window !== "undefined" ? window : globalThis);
