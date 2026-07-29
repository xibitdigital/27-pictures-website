import type { Directive } from "vue";

const observer =
  typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) entry.target.classList.add("active");
          });
        },
        { threshold: 0, rootMargin: "0px 0px 150px 0px" }
      )
    : null;

/** Fade-in on scroll — observes the bound element. */
export const vReveal: Directive<HTMLElement> = {
  mounted(el) {
    el.classList.add("reveal");
    if (observer) observer.observe(el);
    else el.classList.add("active");
  },
  unmounted(el) {
    observer?.unobserve(el);
  },
};
