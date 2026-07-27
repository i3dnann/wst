import {
  useCallback,
  useEffect,
  useRef,
  type HTMLAttributes,
  type Ref,
} from "react";

import { cn } from "@/lib/utils";

interface ScrollProgressProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

export function ScrollProgress({
  className,
  ref,
  ...props
}: ScrollProgressProps) {
  const progressRef = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      progressRef.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        scrollable > 0
          ? Math.min(1, Math.max(0, window.scrollY / scrollable))
          : 0;
      if (progressRef.current)
        progressRef.current.style.transform = `scaleX(${String(progress)})`;
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(document.documentElement);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    update();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return (
    <div
      ref={setRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-px origin-left bg-linear-to-r from-[#6F0D1C] via-[#D0203D] to-[#F04460]",
        className,
      )}
      {...props}
    />
  );
}
