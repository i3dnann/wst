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
  ".admin-data-table tbody tr",
  ".bracket-match-card",
].join(",");

export function ScrollRevealController({ routeKey }: { routeKey: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const observed = new Set<Element>();
    let lastScrollY = window.scrollY;
    let scrollTick = 0;
    let scanTick = 0;

    root.classList.add("ws-motion-ready");
    root.dataset.scrollDirection = "down";

    const updateDirection = () => {
      scrollTick = 0;
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY) > 2) {
        root.dataset.scrollDirection =
          currentScrollY > lastScrollY ? "down" : "up";
        lastScrollY = currentScrollY;
      }
    };

    const onScroll = () => {
      if (!scrollTick) {
        scrollTick = window.requestAnimationFrame(updateDirection);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const direction = root.dataset.scrollDirection ?? "down";
          if (entry.isIntersecting || reducedMotion) {
            element.dataset.revealFrom = direction;
            window.requestAnimationFrame(() => {
              element.classList.add("is-revealed");
            });
          } else if (
            entry.boundingClientRect.bottom < -24 ||
            entry.boundingClientRect.top > window.innerHeight + 24
          ) {
            element.dataset.revealFrom = direction;
            element.classList.remove("is-revealed");
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
          `${String((index % 6) * 45)}ms`,
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
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (scrollTick) window.cancelAnimationFrame(scrollTick);
      if (scanTick) window.cancelAnimationFrame(scanTick);
      window.removeEventListener("scroll", onScroll);
      mutationObserver.disconnect();
      observer.disconnect();
      root.classList.remove("ws-motion-ready");
      delete root.dataset.scrollDirection;
    };
  }, [routeKey]);

  return null;
}
