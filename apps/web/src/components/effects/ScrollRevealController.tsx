import { useEffect } from "react";

const revealSelector = [
  "main > header",
  "main > section",
  "main > div",
  ".site-footer > div",
  ".gang-registry-card",
  ".tournament-ledger-list > article",
  ".event-directory > li",
  ".gold-table-row",
  ".ranking-table-row",
  ".public-directory-card",
  ".match-archive__row",
  ".control-main > header",
  ".control-main > section",
  ".control-main > div",
  ".control-metrics > article",
].join(",");

export function ScrollRevealController({ routeKey }: { routeKey: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const observed = new Set<Element>();
    let scanTick = 0;

    root.classList.add("ws-motion-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting || reducedMotion) {
            window.requestAnimationFrame(() => {
              element.classList.add("is-revealed");
            });
            observer.unobserve(element);
          }
        }
      },
      {
        rootMargin: "0px 0px -5%",
        threshold: 0.08,
      },
    );

    const scan = (scope: ParentNode = document) => {
      const matches =
        scope instanceof Element && scope.matches(revealSelector)
          ? [scope]
          : [];
      const descendants = Array.from(scope.querySelectorAll(revealSelector));
      [...matches, ...descendants].forEach((element, index) => {
        if (
          observed.has(element) ||
          element.closest("[data-disable-scroll-reveal]")
        ) {
          return;
        }
        observed.add(element);
        const htmlElement = element as HTMLElement;
        htmlElement.classList.add("ws-scroll-reveal");
        htmlElement.style.setProperty(
          "--ws-reveal-delay",
          `${String((index % 4) * 35)}ms`,
        );
        if (reducedMotion) htmlElement.classList.add("is-revealed");
        observer.observe(element);
      });
    };

    scan();
    const mutationObserver = new MutationObserver((records) => {
      if (scanTick) return;
      scanTick = window.requestAnimationFrame(() => {
        scanTick = 0;
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element) scan(node);
          }
        }
      });
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    return () => {
      if (scanTick) window.cancelAnimationFrame(scanTick);
      mutationObserver.disconnect();
      observer.disconnect();
      root.classList.remove("ws-motion-ready");
    };
  }, [routeKey]);

  return null;
}
