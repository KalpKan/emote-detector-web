/**
 * The page's two entrance animations, and the single place that decides whether any motion
 * happens at all.
 *
 *   M1  the h1 reveals word by word through a mask, on load (hierarchy)
 *   M2  sections rise into place once, as they are scrolled to (attention)
 *
 * Under `prefers-reduced-motion: reduce` neither is installed. The markup's resting state IS
 * the final state, so the page is complete and static rather than briefly animated — the
 * spec's rule is a complete static final state, never a shortened animation.
 *
 * MengTo's `masked-reveal` supplies M1's mechanics and `animation-on-scroll` supplies M2's
 * observer; both are implemented without GSAP or a smooth-scroll engine, because the direction
 * bans one and the page shares its main thread with a live camera loop.
 */

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Wrap each word of `el` in a mask/word pair. The element keeps its full text as its
 * accessible name and the decorative split is hidden from assistive technology.
 */
export function splitWords(el: HTMLElement): void {
  if (el.dataset.split === "true") return;
  const text = (el.textContent ?? "").trim();
  if (!text) return;
  el.setAttribute("aria-label", text);
  const frag = document.createDocumentFragment();
  let index = 0;
  for (const part of text.split(/(\s+)/)) {
    if (!part.trim()) {
      frag.appendChild(document.createTextNode(part));
      continue;
    }
    const mask = document.createElement("span");
    mask.className = "word-mask";
    mask.setAttribute("aria-hidden", "true");
    const word = document.createElement("span");
    word.className = "word";
    word.style.setProperty("--i", String(index));
    word.textContent = part;
    mask.appendChild(word);
    frag.appendChild(mask);
    index += 1;
  }
  el.replaceChildren(frag);
  el.dataset.split = "true";
  el.classList.add("is-split");
}

let observer: IntersectionObserver | null = null;

export function initReveals(doc: ParentNode = document): void {
  if (prefersReducedMotion()) return;

  for (const el of doc.querySelectorAll<HTMLElement>("[data-word-reveal]")) splitWords(el);

  // Nothing is hidden until this class is on <html>, so a [data-reveal] block can never be left
  // invisible by a script that did not run, an observer that never fired, or a browser without
  // IntersectionObserver. The animation is the opt-in; being readable is the default.
  if (typeof IntersectionObserver !== "function") return;
  document.documentElement.classList.add("reveal-ready");

  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        observer?.unobserve(entry.target);
      }
    },
    { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
  );
  for (const el of doc.querySelectorAll<HTMLElement>("[data-reveal]")) observer.observe(el);
}
