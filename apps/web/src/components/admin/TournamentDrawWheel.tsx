import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LockKeyhole, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const FULL_TURN = 360;
const SPIN_DURATION_MS = 3_000;

export interface DrawParticipant {
  id: string;
  gang: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
  };
}

interface TournamentDrawWheelProps {
  hasBracket: boolean;
  isSaving: boolean;
  participants: DrawParticipant[];
  tournamentName: string;
  onClose: () => void;
  onConfirm: (participantIds: string[]) => void;
}

function secureRandomIndex(length: number): number {
  if (length <= 1) return 0;
  const limit = Math.floor(0x1_0000_0000 / length) * length;
  const random = new Uint32Array(1);
  do {
    window.crypto.getRandomValues(random);
  } while ((random[0] ?? 0) >= limit);
  return (random[0] ?? 0) % length;
}

function polarPoint(angle: number, radius = 49): [number, number] {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [50 + radius * Math.cos(radians), 50 + radius * Math.sin(radians)];
}

function wheelSlice(startAngle: number, endAngle: number): string {
  const [startX, startY] = polarPoint(startAngle);
  const [endX, endY] = polarPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M 50 50 L ${String(startX)} ${String(startY)} A 49 49 0 ${String(largeArc)} 1 ${String(endX)} ${String(endY)} Z`;
}

function wheelLabel(name: string): [string, string?] {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return [words[0]?.slice(0, 11) ?? name.slice(0, 11)];
  return [words[0]?.slice(0, 9) ?? "", words.slice(1).join(" ").slice(0, 11)];
}

export function TournamentDrawWheel({
  hasBracket,
  isSaving,
  participants,
  tournamentName,
  onClose,
  onConfirm,
}: TournamentDrawWheelProps) {
  const participantSignature = participants
    .map((participant) => participant.id)
    .join(":");
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const spinTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (spinTimerRef.current !== null) {
      window.clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }
    setDrawnIds([]);
    setSelectedId(null);
    setSpinning(false);
    setRotation(0);
  }, [participantSignature, tournamentName]);

  useEffect(
    () => () => {
      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current);
      }
    },
    [],
  );

  const participantById = useMemo(
    () =>
      new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );
  const remaining = useMemo(() => {
    const drawn = new Set(drawnIds);
    return participants.filter((participant) => !drawn.has(participant.id));
  }, [drawnIds, participants]);
  const selected = selectedId ? participantById.get(selectedId) : undefined;
  const entrantCountIsValid =
    participants.length > 1 &&
    participants.length <= 32 &&
    (participants.length & (participants.length - 1)) === 0;
  const complete =
    entrantCountIsValid && drawnIds.length === participants.length;
  const matchupCount = Math.max(1, Math.ceil(participants.length / 2));
  const matchups = Array.from({ length: matchupCount }, (_, index) => ({
    gangA: participantById.get(drawnIds[index * 2] ?? ""),
    gangB: participantById.get(drawnIds[index * 2 + 1] ?? ""),
  }));

  const spin = () => {
    if (spinning || isSaving || !remaining.length || !entrantCountIsValid)
      return;
    const selectedIndex = secureRandomIndex(remaining.length);
    const nextParticipant = remaining[selectedIndex];
    if (!nextParticipant) return;

    const sliceAngle = FULL_TURN / remaining.length;
    const selectedCenter = (selectedIndex + 0.5) * sliceAngle;
    const currentRotation = ((rotation % FULL_TURN) + FULL_TURN) % FULL_TURN;
    const targetRotation = (FULL_TURN - selectedCenter) % FULL_TURN;
    const finalAdjustment =
      (targetRotation - currentRotation + FULL_TURN) % FULL_TURN;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reducedMotion ? 120 : SPIN_DURATION_MS;

    setSelectedId(null);
    setSpinning(true);
    setRotation(
      (current) =>
        current + (reducedMotion ? 0 : FULL_TURN * 5) + finalAdjustment,
    );
    spinTimerRef.current = window.setTimeout(() => {
      setDrawnIds((current) => [...current, nextParticipant.id]);
      setSelectedId(nextParticipant.id);
      setSpinning(false);
      spinTimerRef.current = null;
    }, duration);
  };

  const resetDraw = () => {
    if (spinning || isSaving) return;
    setDrawnIds([]);
    setSelectedId(null);
    setRotation(0);
  };

  const sliceAngle = remaining.length
    ? FULL_TURN / remaining.length
    : FULL_TURN;
  const wheelStyle = {
    "--draw-wheel-duration": `${String(spinning ? SPIN_DURATION_MS : 0)}ms`,
    transform: `rotate(${String(rotation)}deg)`,
  } as CSSProperties;

  return (
    <section className="champions-draw" aria-labelledby="champions-draw-title">
      <header className="champions-draw__header">
        <div>
          <h3 id="champions-draw-title">Champions Draw</h3>
          <p>{tournamentName}</p>
        </div>
        <div className="champions-draw__metrics" aria-label="Draw progress">
          <span>
            <strong>{participants.length}</strong> entrants
          </span>
          <span>
            <strong>{drawnIds.length}</strong> of {participants.length} drawn
          </span>
        </div>
        <button
          type="button"
          className="champions-draw__reset"
          disabled={!drawnIds.length || spinning || isSaving}
          onClick={resetDraw}
        >
          <RotateCcw /> Reset draw
        </button>
        <button
          type="button"
          className="champions-draw__close"
          aria-label="Close Champions Draw"
          onClick={onClose}
        >
          <X />
        </button>
      </header>

      {!entrantCountIsValid ? (
        <div className="champions-draw__notice" role="alert">
          <Sparkles />
          <div>
            <strong>A complete knockout field is required</strong>
            <p>
              Approve exactly 2, 4, 8, 16, or 32 gangs before starting the draw.
              This guarantees every two spins become one opening match.
            </p>
          </div>
        </div>
      ) : null}

      <div className="champions-draw__body">
        <div className="champions-draw__wheel-column">
          <div className="champions-draw__pointer" aria-hidden="true" />
          <div
            className={`champions-draw__wheel${spinning ? " is-spinning" : ""}`}
            style={wheelStyle}
            aria-hidden="true"
          >
            <svg viewBox="0 0 100 100">
              {remaining.length ? (
                remaining.map((participant, index) => {
                  const start = index * sliceAngle;
                  const end = start + sliceAngle;
                  const mid = start + sliceAngle / 2;
                  const [labelX, labelY] = polarPoint(mid, 34);
                  const [firstLine, secondLine] = wheelLabel(
                    participant.gang.name,
                  );
                  return (
                    <g key={participant.id}>
                      <path
                        d={wheelSlice(start, end)}
                        className={index % 2 ? "is-dark" : "is-red"}
                      />
                      <text
                        x={labelX}
                        y={labelY - (secondLine ? 1.4 : 0)}
                        textAnchor="middle"
                        style={{
                          fontSize:
                            remaining.length > 12
                              ? "1.9px"
                              : remaining.length > 8
                                ? "2.35px"
                                : "2.8px",
                        }}
                      >
                        <tspan x={labelX}>{firstLine}</tspan>
                        {secondLine ? (
                          <tspan x={labelX} dy="2.8">
                            {secondLine}
                          </tspan>
                        ) : null}
                      </text>
                    </g>
                  );
                })
              ) : (
                <circle cx="50" cy="50" r="49" />
              )}
              <circle
                className="champions-draw__wheel-ring"
                cx="50"
                cy="50"
                r="18"
              />
            </svg>
            <img src="/assets/wst/wst-logo.png" alt="" />
          </div>
          <Button
            type="button"
            className="champions-draw__spin"
            disabled={
              spinning || isSaving || !remaining.length || !entrantCountIsValid
            }
            onClick={spin}
          >
            <RotateCcw />
            {spinning
              ? "Drawing…"
              : remaining.length
                ? "Spin next gang"
                : "Draw complete"}
          </Button>
        </div>

        <div className="champions-draw__results">
          <div className="champions-draw__winner" aria-live="polite">
            {selected ? (
              <>
                <div>
                  {selected.gang.logoUrl ? (
                    <img src={selected.gang.logoUrl} alt="" />
                  ) : (
                    <Trophy />
                  )}
                </div>
                <span>
                  Drawn gang<strong>{selected.gang.name}</strong>
                </span>
              </>
            ) : (
              <span>
                Next selection
                <strong>
                  {spinning ? "Wheel spinning…" : "Ready to draw"}
                </strong>
              </span>
            )}
          </div>
          <section className="champions-draw__matchups">
            <header>
              <h4>Opening matchups</h4>
              <span>{matchupCount} matches</span>
            </header>
            <ol>
              {matchups.map((matchup, index) => {
                const active =
                  index === Math.floor(drawnIds.length / 2) && !complete;
                return (
                  <li className={active ? "is-active" : ""} key={index}>
                    <span>{index + 1}</span>
                    <strong>
                      {matchup.gangA?.gang.name ?? "Waiting for draw"}
                    </strong>
                    <em>VS</em>
                    <strong>
                      {matchup.gangB?.gang.name ?? "Waiting for draw"}
                    </strong>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>

      <footer className="champions-draw__footer">
        <div>
          <LockKeyhole />
          <span>
            <strong>Review before confirming</strong>
            {hasBracket
              ? "Confirming replaces the current bracket and clears its results."
              : "The exact draw order will be saved into the opening bracket."}
          </span>
        </div>
        <Button
          type="button"
          disabled={!complete || spinning || isSaving}
          onClick={() => onConfirm(drawnIds)}
        >
          <LockKeyhole />
          {isSaving ? "Building bracket…" : "Confirm draw & build bracket"}
        </Button>
      </footer>
    </section>
  );
}
