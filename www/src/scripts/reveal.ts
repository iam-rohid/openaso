// Fades [data-reveal] elements in the first time they scroll into view (see global.css).
// Children of a [data-reveal-stagger] parent get increasing delays.

for (const group of document.querySelectorAll<HTMLElement>("[data-reveal-stagger]")) {
  const step = Number(group.dataset.revealStagger) || 80;
  group.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el, i) => {
    el.style.setProperty("--reveal-delay", `${i * step}ms`);
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.setAttribute("data-revealed", "");
      observer.unobserve(entry.target);
    }
  },
  { rootMargin: "0px 0px -8% 0px" },
);

for (const el of document.querySelectorAll("[data-reveal]")) observer.observe(el);
