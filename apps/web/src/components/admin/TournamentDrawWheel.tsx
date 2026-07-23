import { useEffect, useMemo, useRef, useState } from "react";
import { LockKeyhole, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawWheelGraphic } from "@/components/tournaments/DrawWheelGraphic";
import type {
  LiveDrawParticipant,
  LiveDrawSpinResult,
  LiveTournamentDraw,
} from "@/lib/api";

const FULL_TURN = 360;
const SPIN_DURATION_MS = 8_000;
const SPIN_FULL_TURNS = 10;

export type DrawParticipant = LiveDrawParticipant;

interface TournamentDrawWheelProps {
  hasBracket: boolean;
  isSaving: boolean;
  participants: DrawParticipant[];
  tournamentName: string;
  onClose: () => Promise<void> | void;
  onConfirm: (participantIds: string[]) => void;
  onError: (message: string) => void;
  onReset: () => Promise<LiveTournamentDraw>;
  onSpin: () => Promise<LiveDrawSpinResult>;
}

export function TournamentDrawWheel({
  hasBracket,
  isSaving,
  participants,
  tournamentName,
  onClose,
  onConfirm,
  onError,
  onReset,
  onSpin,
}: TournamentDrawWheelProps) {
  const participantSignature = participants
    .map((participant) => participant.id)
    .join(":");
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState(SPIN_DURATION_MS);
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

  const spin = async () => {
    if (spinning || isSaving || !remaining.length || !entrantCountIsValid)
      return;
    setSelectedId(null);
    setSpinning(true);
    setRequestPending(true);
    try {
      const result = await onSpin();
      const selectedIndex = remaining.findIndex(
        (participant) => participant.id === result.selectedParticipantId,
      );
      if (selectedIndex < 0)
        throw new Error("The selected gang is not available.");
      const sliceAngle = FULL_TURN / remaining.length;
      const selectedCenter = (selectedIndex + 0.5) * sliceAngle;
      const currentRotation = ((rotation % FULL_TURN) + FULL_TURN) % FULL_TURN;
      const targetRotation = (FULL_TURN - selectedCenter) % FULL_TURN;
      const finalAdjustment =
        (targetRotation - currentRotation + FULL_TURN) % FULL_TURN;
      setSpinDuration(result.durationMs);
      setRotation(
        (current) => current + FULL_TURN * SPIN_FULL_TURNS + finalAdjustment,
      );
      spinTimerRef.current = window.setTimeout(() => {
        setDrawnIds(result.draw.drawnParticipantIds);
        setSelectedId(result.selectedParticipantId);
        setSpinning(false);
        spinTimerRef.current = null;
      }, result.durationMs);
    } catch (error) {
      setSpinning(false);
      onError(error instanceof Error ? error.message : "The live draw failed.");
    } finally {
      setRequestPending(false);
    }
  };

  const resetDraw = async () => {
    if (spinning || isSaving) return;
    setRequestPending(true);
    try {
      const draw = await onReset();
      setDrawnIds(draw.drawnParticipantIds);
      setSelectedId(null);
      setRotation(0);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "The draw could not reset.",
      );
    } finally {
      setRequestPending(false);
    }
  };

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
          disabled={!drawnIds.length || spinning || isSaving || requestPending}
          onClick={() => void resetDraw()}
        >
          <RotateCcw /> Reset draw
        </button>
        <button
          type="button"
          className="champions-draw__close"
          aria-label="Close Champions Draw"
          onClick={() => void onClose()}
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
          <DrawWheelGraphic
            participants={remaining}
            rotation={rotation}
            spinning={spinning}
            durationMs={spinDuration}
          />
          <Button
            type="button"
            className="champions-draw__spin"
            disabled={
              spinning ||
              requestPending ||
              isSaving ||
              !remaining.length ||
              !entrantCountIsValid
            }
            onClick={() => void spin()}
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
