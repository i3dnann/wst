import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

interface MatchCountdownProps {
  scheduledAt: string | null | undefined;
  compact?: boolean;
}

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getCountdown(target: number, now: number): CountdownParts | null {
  const remaining = target - now;
  if (!Number.isFinite(target) || remaining <= 0) return null;
  const totalSeconds = Math.ceil(remaining / 1_000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function MatchCountdown({ scheduledAt, compact = false }: MatchCountdownProps) {
  const target = useMemo(() => new Date(scheduledAt ?? "").getTime(), [scheduledAt]);
  const [now, setNow] = useState(() => Date.now());
  const countdown = getCountdown(target, now);

  useEffect(() => {
    if (!Number.isFinite(target) || target <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!countdown) return null;

  const units = [
    ["D", countdown.days],
    ["H", countdown.hours],
    ["M", countdown.minutes],
    ["S", countdown.seconds],
  ] as const;

  return (
    <div
      className={`match-countdown${compact ? " match-countdown--compact" : ""}`}
      aria-label={`Match starts in ${String(countdown.days)} days, ${String(countdown.hours)} hours, ${String(countdown.minutes)} minutes, and ${String(countdown.seconds)} seconds`}
    >
      <span className="match-countdown__label"><Clock3 aria-hidden="true" /> Starts in</span>
      <span className="match-countdown__clock" aria-hidden="true">
        {units.map(([label, value], index) => (
          <span className="match-countdown__unit" key={label}>
            {index > 0 ? <i>:</i> : null}
            <b>{twoDigits(value)}</b>
            <small>{label}</small>
          </span>
        ))}
      </span>
      <span className="match-countdown__pulse" aria-hidden="true" />
    </div>
  );
}
