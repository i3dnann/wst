import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";

const CELEBRATION_DURATION_MS = 3_000;
const OVERLAY_DURATION_MS = 4_200;
const CONFETTI_COLORS = ["#c51f38", "#ef4058", "#d7c7a1", "#fff8ee"];

interface ChampionCelebrationProps {
  celebrationId: string;
  tournamentName: string;
  winnerName: string;
}

export function ChampionCelebration({
  celebrationId,
  tournamentName,
  winnerName,
}: ChampionCelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const end = Date.now() + CELEBRATION_DURATION_MS;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let animationFrame = 0;

    const fireSideCannons = () => {
      if (Date.now() > end) return;
      const options = {
        particleCount: 2,
        spread: 55,
        startVelocity: 60,
        colors: CONFETTI_COLORS,
        zIndex: 2300,
        disableForReducedMotion: true,
      };

      void confetti({
        ...options,
        angle: 60,
        origin: { x: 0, y: 0.55 },
      });
      void confetti({
        ...options,
        angle: 120,
        origin: { x: 1, y: 0.55 },
      });
      animationFrame = window.requestAnimationFrame(fireSideCannons);
    };

    if (!reducedMotion) fireSideCannons();
    const hideTimer = window.setTimeout(
      () => setVisible(false),
      OVERLAY_DURATION_MS,
    );

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(hideTimer);
    };
  }, [celebrationId]);

  if (!visible) return null;

  return (
    <section
      className="champion-celebration"
      role="status"
      aria-live="assertive"
      aria-label={`${winnerName} won ${tournamentName}`}
    >
      <div className="champion-celebration__halo" aria-hidden="true" />
      <div className="champion-celebration__card">
        <img src="/assets/wst/wst-logo.png" alt="" />
        <Trophy aria-hidden="true" />
        <span>World Star Champion</span>
        <strong>{winnerName}</strong>
        <small>{tournamentName}</small>
      </div>
    </section>
  );
}
