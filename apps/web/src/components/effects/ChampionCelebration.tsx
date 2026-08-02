import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";

const CELEBRATION_DURATION_MS = 5_000;
const OVERLAY_DURATION_MS = 5_800;
const CONFETTI_COLORS = ["#0d1433", "#171f55", "#274272", "#6c90c3"];

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
    let lastSideBurst = 0;
    let lastCenterBurst = 0;

    const fireFireworks = () => {
      const now = Date.now();
      if (now > end) return;
      if (now - lastSideBurst >= 64) {
        lastSideBurst = now;
        const options = {
          particleCount: 3,
          spread: 62,
          startVelocity: 64,
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
      }

      if (now - lastCenterBurst >= 700) {
        lastCenterBurst = now;
        void confetti({
          particleCount: 42,
          spread: 86,
          startVelocity: 38,
          gravity: 0.85,
          scalar: 0.9,
          origin: { x: 0.5, y: 0.28 },
          colors: CONFETTI_COLORS,
          zIndex: 2300,
          disableForReducedMotion: true,
        });
      }

      animationFrame = window.requestAnimationFrame(fireFireworks);
    };

    if (!reducedMotion) fireFireworks();
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
