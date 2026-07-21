import { cn } from "@/lib/utils";

export function Ripple({
  className,
  mainCircleSize = 210,
  mainCircleOpacity = 0.22,
  numCircles = 8,
}: {
  className?: string;
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
}) {
  return (
    <div className={cn("wst-ripple", className)} aria-hidden="true">
      {Array.from({ length: numCircles }, (_, index) => {
        const size = mainCircleSize + index * 74;
        return (
          <span
            key={size}
            style={{
              width: size,
              height: size,
              opacity: Math.max(mainCircleOpacity - index * 0.022, 0.025),
              animationDelay: `${String(index * -0.36)}s`,
            }}
          />
        );
      })}
    </div>
  );
}
