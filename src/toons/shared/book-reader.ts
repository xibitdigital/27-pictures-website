// @ts-nocheck — imperative DOM port; public API typed in types.ts
/**
 * Shared page-turning book reader for 27 Pictures toons (Erin, Jax, …).
 * Imperative flip engine. Pass DOM nodes from Vue template refs via initToonBook(els, opts).
 */
import type { ToonBookApi, ToonBookEls, ToonBookOptions, ToonManifest } from "./types";

const FLIP_MS = 700;
const FLIP_SAFETY_MS = FLIP_MS + 200;
const SINGLE_FLIP_MS = 350;

/**
 * @param els - Required book DOM nodes (from Vue refs, not getElementById)
 * @param opts - Behaviour / content options
 */
export function initToonBook(
  els: ToonBookEls,
  opts: ToonBookOptions = {}
): ToonBookApi | undefined {
    const altPrefix = opts.altPrefix || "Page";
    const manifestUrl = opts.manifestUrl || "manifest.json";
    const backHref = opts.backHref || "/experiments/";
    const backLabel = opts.backLabel || "← experiments";
    const onPagePaint = typeof opts.onPagePaint === "function" ? opts.onPagePaint : null;
    const onPageClear = typeof opts.onPageClear === "function" ? opts.onPageClear : null;
    const beforeStart = typeof opts.beforeStart === "function" ? opts.beforeStart : null;
    const frontCoverLogo = opts.frontCoverLogo || null;
    const coverTitle = opts.coverTitle || altPrefix || "";
    const coverSubtitle =
      opts.coverSubtitle !== undefined ? opts.coverSubtitle : "Experiment";
    const soundHint = opts.soundHint || null;
    const getSoundEnabled = typeof opts.getSoundEnabled === "function" ? opts.getSoundEnabled : () => false;
    const onSoundToggle = typeof opts.onSoundToggle === "function" ? opts.onSoundToggle : null;
    const coverTexture = opts.coverTexture || null;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const singlePageMq = window.matchMedia("(max-width: 768px)");

    let pages: string[] = [];
    let totalSpreads = 0;
    let viewIndex = 0;
    let singlePage = singlePageMq.matches;
    let isFlipping = false;
    let flipSafetyTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    document.body.classList.toggle("single-page", singlePage);

    const bookEl = els.book;
    const slotLeft = els.slotLeft;
    const slotRight = els.slotRight;
    const indicator = els.indicator;
    const btnPrev = els.btnPrev;
    const btnNext = els.btnNext;
    const zoneNext = els.zoneNext ?? null;
    const zonePrev = els.zonePrev ?? null;
    const topControls = els.topControls ?? null;

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
      const manifest = (await res.json()) as ToonManifest;
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
      const esc = (s) => String(s).replace(/</g, "&lt;");
      const titleHtml = coverTitle
        ? `<h1 class="front-cover-title">${esc(coverTitle)}</h1>`
        : "";
      const subtitleHtml = coverSubtitle
        ? `<p class="front-cover-subtitle">${esc(coverSubtitle)}</p>`
        : "";
      wrap.innerHTML = `
        ${titleHtml}
        ${subtitleHtml}
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
      `;
      if (soundHint) {
        const soundOn = !!getSoundEnabled();
        const btn = document.createElement("button");
        btn.type = "button";
        // is-active = shared top-chrome on-state; is-enabled kept for front-cover CSS.
        btn.className =
          "toon-fs-btn front-cover-sound-btn" + (soundOn ? " is-active is-enabled" : "");
        btn.setAttribute("aria-pressed", String(soundOn));
        btn.title = soundOn ? "Mute sound" : "Enable sound";
        btn.setAttribute("aria-label", btn.title);
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M4 9v6h4l5 4V5L8 9H4z" stroke-linecap="round" stroke-linejoin="round" />
                  <path class="front-cover-sound-waves" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke-linecap="round" stroke-linejoin="round" />
                </svg>`;
        const span = document.createElement("span");
        span.dataset.offLabel = soundHint;
        span.textContent = soundOn ? "Sound on" : soundHint;
        btn.appendChild(span);
        if (onSoundToggle) btn.addEventListener("click", (e) => { e.stopPropagation(); onSoundToggle(); });
        const note = document.createElement("p");
        note.className = "front-cover-sound-note";
        note.textContent = "Hover (or tap) glowing captions on any page to hear them";
        wrap.appendChild(btn);
        wrap.appendChild(note);
      }
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

    /** Apply or clear hardcover texture on an inside-cover face/slot. */
    function setCoverBoard(el, on) {
      if (!el) return;
      el.classList.toggle("inside-cover", !!on);
      // Remove any previous board image (re-renders clear via innerHTML too,
      // but flip faces reuse this helper without a full wipe).
      Array.from(el.children).forEach((n) => {
        if (n.tagName === "IMG" && n.classList.contains("cover-texture-img")) n.remove();
      });
      el.classList.remove("has-cover-texture");
      if (on && coverTexture) {
        el.classList.add("has-cover-texture");
        // Real <img> is more reliable than background-image (cascade with the
        // .inside-cover gradient shorthand was hiding the texture on live).
        const img = document.createElement("img");
        img.className = "cover-texture-img";
        img.src = coverTexture;
        img.alt = "";
        img.draggable = false;
        img.setAttribute("aria-hidden", "true");
        el.insertBefore(img, el.firstChild);
      }
    }

    function renderSlot(slot, src, isInsideCover, spread, side) {
      slot.innerHTML = "";
      slot.classList.toggle("blank", !src && !isInsideCover);
      const showCover = !src && isInsideCover;
      setCoverBoard(slot, showCover);
      if (src) {
        appendPageImage(slot, src, pageNumber(spread, side));
      } else {
        delete slot.dataset.pageNum;
        if (onPageClear) onPageClear(slot);
        if (showCover && isFrontCover(spread, side)) {
          slot.appendChild(renderFrontCoverInstructions());
        } else if (showCover && isBackCover(spread, side)) {
          renderBackCoverLink(slot);
        }
      }
    }

    function renderSingleSlot(content) {
      const slot = slotRight;
      slot.innerHTML = "";
      slot.classList.remove("blank");
      const showCover = content.kind !== "page";
      setCoverBoard(slot, showCover);
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
        } else {
          indicator.textContent = "";
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
      else setCoverBoard(back, true);

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
        setCoverBoard(face, true);
        face.appendChild(renderFrontCoverInstructions());
      } else {
        setCoverBoard(face, true);
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

    /** Decode page art before swapping so the slot never flashes empty. */
    function preloadSrc(src) {
      return new Promise((resolve) => {
        if (!src) {
          resolve();
          return;
        }
        const img = new Image();
        let done = false;
        const fin = () => {
          if (done) return;
          done = true;
          resolve();
        };
        img.onload = fin;
        img.onerror = fin;
        img.src = src;
        if (img.complete) fin();
      });
    }

    /**
     * End of page-turn: paint final spread UNDER the flip overlay, wait for a
     * frame so the browser composites it, then remove the overlay.
     * Avoids a one-frame flash of empty/old page when the flip is torn down.
     */
    function finishFlip(flip, target) {
      // Settled guard lives on the caller; here just tear down safely.
      if (flipSafetyTimer) {
        clearTimeout(flipSafetyTimer);
        flipSafetyTimer = null;
      }
      isFlipping = false;
      viewIndex = target;
      // Caller already painted the late slot under the flip. Sync indicator and
      // ensure both slots match target without wiping again if possible.
      updateIndicator();
      // Double-rAF: wait until the late page is composited, then drop the leaf.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (flip.isConnected) flip.remove();
        });
      });
    }

    async function turnDesktop(delta) {
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

      const frontSrc = goingNext ? curRight : curLeft;
      const backSrc = goingNext ? nextLeft : nextRight;
      const earlySlot = goingNext ? slotRight : slotLeft;
      const earlySrc = goingNext ? nextRight : nextLeft;
      const lateSlot = goingNext ? slotLeft : slotRight;
      const lateSrc = goingNext ? nextLeft : nextRight;

      isFlipping = true;
      await Promise.all([
        preloadSrc(frontSrc),
        preloadSrc(backSrc),
        preloadSrc(earlySrc),
        preloadSrc(lateSrc),
      ]);
      // Aborted or mode-switched during preload.
      if (!isFlipping) return;

      const flip = createFlipOverlay(goingNext ? "next" : "prev", frontSrc, backSrc);
      // Incoming page under the flipping leaf only (right on next, left on prev).
      // The opposite page stays as-is until finishFlip, when the leaf covers it.
      renderSlot(earlySlot, earlySrc, !earlySrc, target, goingNext ? "right" : "left");

      let settled = false;
      const complete = () => {
        if (settled) return;
        settled = true;
        // Paint the late page while the finished flip still covers that half.
        renderSlot(lateSlot, lateSrc, !lateSrc, target, lateSlot === slotLeft ? "left" : "right");
        finishFlip(flip, target);
      };
      flip.addEventListener(
        "animationend",
        (e) => {
          if (e.target !== flip) return;
          complete();
        },
        { once: true }
      );
      flipSafetyTimer = setTimeout(complete, FLIP_SAFETY_MS);
    }

    async function turnSingle(delta) {
      const target = viewIndex + delta;
      if (target < 0 || target >= totalViews()) return;

      if (reduceMotion) {
        viewIndex = target;
        updateView(false);
        return;
      }

      const leaving = singleViewContent(viewIndex);
      const arriving = singleViewContent(target);
      const leaveSrc = leaving.kind === "page" ? leaving.src : null;
      const arriveSrc = arriving.kind === "page" ? arriving.src : null;

      isFlipping = true;
      await Promise.all([preloadSrc(leaveSrc), preloadSrc(arriveSrc)]);
      if (!isFlipping) return;

      // Cover the current page first, then paint the destination underneath
      // so the user never sees an unpainted slot flash.
      const flip = createSingleFlipOverlay(delta > 0 ? "next" : "prev", leaving);
      renderSingleSlot(arriving);

      let settled = false;
      const complete = () => {
        if (settled) return;
        settled = true;
        finishFlip(flip, target);
      };
      flip.addEventListener(
        "animationend",
        (e) => {
          if (e.target !== flip) return;
          complete();
        },
        { once: true }
      );
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
        Array.from(bookEl.children).forEach((el) => {
          if (el.classList && el.classList.contains("flip-page")) el.remove();
        });
        isFlipping = false;
      }
      if (nextSingle) viewIndex = spreadToSingle(viewIndex);
      else viewIndex = singleToSpread(viewIndex);
      singlePage = nextSingle;
      updateView(false);
    }

    const goNext = () => turn(1);
    const goPrev = () => turn(-1);

    function onKeydown(e) {
      if (destroyed) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }

    let touchStartX = 0;
    function onTouchStart(e) {
      touchStartX = e.touches[0].clientX;
    }
    function onTouchEnd(e) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) < 40) return;
      if (dx > 0) goPrev();
      else goNext();
    }

    function onSinglePageMq(e) {
      applyMode(e.matches);
    }

    if (zoneNext) zoneNext.addEventListener("click", goNext);
    if (zonePrev) zonePrev.addEventListener("click", goPrev);
    btnPrev.addEventListener("click", goPrev);
    btnNext.addEventListener("click", goNext);
    document.addEventListener("keydown", onKeydown);
    bookEl.addEventListener("touchstart", onTouchStart, { passive: true });
    bookEl.addEventListener("touchend", onTouchEnd, { passive: true });

    if (typeof singlePageMq.addEventListener === "function") {
      singlePageMq.addEventListener("change", onSinglePageMq);
    } else {
      singlePageMq.addListener(onSinglePageMq);
    }


    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (zoneNext) zoneNext.removeEventListener("click", goNext);
      if (zonePrev) zonePrev.removeEventListener("click", goPrev);
      btnPrev.removeEventListener("click", goPrev);
      btnNext.removeEventListener("click", goNext);
      document.removeEventListener("keydown", onKeydown);
      bookEl.removeEventListener("touchstart", onTouchStart);
      bookEl.removeEventListener("touchend", onTouchEnd);
      if (typeof singlePageMq.removeEventListener === "function") {
        singlePageMq.removeEventListener("change", onSinglePageMq);
      } else if (singlePageMq.removeListener) {
        singlePageMq.removeListener(onSinglePageMq);
      }
      if (flipSafetyTimer) clearTimeout(flipSafetyTimer);
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

      totalSpreads = Math.ceil((pages.length + 1) / 2);
      pages.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
      viewIndex = 0;
      document.body.classList.toggle("single-page", singlePage);
      updateView(false);
      highlightTopControls();
    }

    /** Flash the top menu group 3 times so users notice Sound / Scroll / etc. */
    function highlightTopControls() {
      const el = topControls;
      if (!el) return;
      el.classList.remove("is-highlight-pulse");
      // Force reflow so re-adding the class restarts the animation.
      void el.offsetWidth;
      el.classList.add("is-highlight-pulse");
      const clear = () => el.classList.remove("is-highlight-pulse");
      // 3 × 0.48s ≈ 1.44s; clear a beat after so the last flash finishes.
      // (animationend on multi-iteration + ::before is unreliable across browsers.)
      window.setTimeout(clear, 1700);
    }

    start();

    return {
      turn,
      goNext,
      goPrev,
      updateView,
      getViewIndex: () => viewIndex,
      getPages: () => pages.slice(),
      destroy,
    };
  }
