import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CircleCheck, Radio, Swords, Trophy } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { DrawWheelGraphic } from "@/components/tournaments/DrawWheelGraphic";
import {
  api,
  type LiveDrawParticipant,
  type LiveTournamentDraw,
  type RealtimeEvent,
} from "@/lib/api";

const FULL_TURN = 360;
const SPIN_DURATION_MS = 8_000;
const SPIN_FULL_TURNS = 10;

interface BroadcastState {
  draw: LiveTournamentDraw;
  spin?: {
    eventId: number;
    selectedParticipantId: string;
    durationMs: number;
  };
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function BroadcastGang({
  participant,
}: {
  participant: LiveDrawParticipant | undefined;
}) {
  if (!participant) {
    return (
      <strong className="live-draw-broadcast__gang is-waiting">
        <span className="live-draw-broadcast__gang-mark" aria-hidden="true" />
        <span>Waiting for draw</span>
      </strong>
    );
  }

  return (
    <strong className="live-draw-broadcast__gang">
      {participant.gang.logoUrl ? (
        <img src={participant.gang.logoUrl} alt="" />
      ) : (
        <span className="live-draw-broadcast__gang-mark" aria-hidden="true">
          {participant.gang.tag.slice(0, 1)}
        </span>
      )}
      <span>{participant.gang.name}</span>
    </strong>
  );
}

export function LiveDrawBroadcast({ state }: { state: BroadcastState }) {
  const { draw, spin } = state;
  const [displayedDrawnIds, setDisplayedDrawnIds] = useState(
    draw.drawnParticipantIds,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    draw.drawnParticipantIds.at(-1) ?? null,
  );
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const completionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    if (!spin) {
      setDisplayedDrawnIds(draw.drawnParticipantIds);
      setSelectedId(draw.drawnParticipantIds.at(-1) ?? null);
      setSpinning(false);
      return;
    }
    const drawnBeforeSpin = draw.drawnParticipantIds.slice(0, -1);
    const drawnBeforeSpinSet = new Set(drawnBeforeSpin);
    const wheelParticipants = draw.participants.filter(
      (participant) => !drawnBeforeSpinSet.has(participant.id),
    );
    const selectedIndex = wheelParticipants.findIndex(
      (participant) => participant.id === spin.selectedParticipantId,
    );
    if (selectedIndex < 0) return;
    const sliceAngle = FULL_TURN / wheelParticipants.length;
    const selectedCenter = (selectedIndex + 0.5) * sliceAngle;
    setDisplayedDrawnIds(drawnBeforeSpin);
    setSelectedId(null);
    setSpinning(true);
    setRotation((current) => {
      const normalizedCurrent = ((current % FULL_TURN) + FULL_TURN) % FULL_TURN;
      const targetRotation = (FULL_TURN - selectedCenter) % FULL_TURN;
      const finalAdjustment =
        (targetRotation - normalizedCurrent + FULL_TURN) % FULL_TURN;
      return current + FULL_TURN * SPIN_FULL_TURNS + finalAdjustment;
    });
    completionTimerRef.current = window.setTimeout(() => {
      setDisplayedDrawnIds(draw.drawnParticipantIds);
      setSelectedId(spin.selectedParticipantId);
      setSpinning(false);
      completionTimerRef.current = null;
    }, spin.durationMs);
    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    };
  }, [draw, spin]);

  const participantById = useMemo(
    () =>
      new Map(
        draw.participants.map((participant) => [participant.id, participant]),
      ),
    [draw.participants],
  );
  const drawn = new Set(displayedDrawnIds);
  const remaining = draw.participants.filter(
    (participant) => !drawn.has(participant.id),
  );
  const selected = selectedId ? participantById.get(selectedId) : undefined;
  const matchupCount = draw.participants.length / 2;
  const matchups = Array.from({ length: matchupCount }, (_, index) => ({
    gangA: participantById.get(displayedDrawnIds[index * 2] ?? ""),
    gangB: participantById.get(displayedDrawnIds[index * 2 + 1] ?? ""),
  }));
  const drawnCount = displayedDrawnIds.length;
  const totalParticipants = draw.participants.length;
  const pairedMatchups = Math.floor(drawnCount / 2);
  const activeMatchupIndex =
    drawnCount < totalParticipants ? Math.floor(drawnCount / 2) : -1;

  return (
    <aside className="live-draw-broadcast" aria-live="polite">
      <div className="live-draw-broadcast__panel">
        <header className="live-draw-broadcast__header">
          <div className="live-draw-broadcast__identity">
            <span className="live-draw-broadcast__live-label">
              <Radio /> Live tournament draw
            </span>
            <h2>{draw.tournamentName}</h2>
          </div>
          <div className="live-draw-broadcast__crest" aria-hidden="true">
            <img src="/assets/wst/wst-logo.png" alt="" />
          </div>
          <div
            className="live-draw-broadcast__progress"
            role="progressbar"
            aria-label="Tournament draw progress"
            aria-valuemin={0}
            aria-valuemax={totalParticipants}
            aria-valuenow={drawnCount}
          >
            <strong>
              <b>{drawnCount}</b>
              <span>/ {totalParticipants} drawn</span>
            </strong>
            <div
              className="live-draw-broadcast__progress-track"
              aria-hidden="true"
              style={{
                gridTemplateColumns: `repeat(${String(totalParticipants)}, minmax(3px, 1fr))`,
              }}
            >
              {draw.participants.map((participant, index) => (
                <i
                  className={index < drawnCount ? "is-filled" : undefined}
                  key={participant.id}
                />
              ))}
            </div>
          </div>
        </header>
        <div className="live-draw-broadcast__content">
          <section className="live-draw-broadcast__wheel">
            <div
              className={`live-draw-broadcast__wheel-visual${spinning ? " is-spinning" : ""}`}
            >
              <div className="live-draw-broadcast__orbit" aria-hidden="true" />
              <DrawWheelGraphic
                participants={remaining}
                rotation={rotation}
                spinning={spinning}
                durationMs={spin?.durationMs ?? SPIN_DURATION_MS}
              />
            </div>
            <div className="live-draw-broadcast__selection">
              {selected ? (
                <>
                  <div className="live-draw-broadcast__selection-icon">
                    {selected.gang.logoUrl ? (
                      <img src={selected.gang.logoUrl} alt="" />
                    ) : (
                      <Trophy aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <span>Latest selection</span>
                    <strong>{selected.gang.name}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="live-draw-broadcast__selection-icon">
                    <Radio aria-hidden="true" />
                  </div>
                  <div>
                    <span>
                      Live selection · {drawnCount + 1} of {totalParticipants}
                    </span>
                    <strong>
                      {spinning ? "Wheel spinning…" : "Waiting for admin"}
                    </strong>
                  </div>
                </>
              )}
              <div
                className={`live-draw-broadcast__selection-state${spinning ? " is-live" : ""}`}
              >
                <i aria-hidden="true" />
                <span>{spinning ? "Selecting" : "Synchronized"}</span>
              </div>
            </div>
          </section>
          <section className="live-draw-broadcast__matchups">
            <header>
              <div>
                <Swords aria-hidden="true" />
                <h3>Opening matchups</h3>
              </div>
              <span>
                {pairedMatchups} of {matchupCount} confirmed
              </span>
            </header>
            <ol>
              {matchups.map((matchup, index) => {
                const complete = Boolean(matchup.gangA && matchup.gangB);
                const active = index === activeMatchupIndex && !complete;
                return (
                  <li
                    className={`${complete ? "is-complete" : ""}${active ? " is-active" : ""}`}
                    key={index}
                  >
                    <span className="live-draw-broadcast__match-number">
                      {complete ? (
                        <CircleCheck aria-hidden="true" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <BroadcastGang participant={matchup.gangA} />
                    <em>VS</em>
                    <BroadcastGang participant={matchup.gangB} />
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
        <footer className="live-draw-broadcast__footer">
          <span>
            <i aria-hidden="true" />
            Results synchronized live from the World Star command center
          </span>
          <Link to={`/tournaments/${draw.tournamentSlug}`}>
            View bracket <ArrowRight aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </aside>
  );
}

export function RealtimeBridge() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [broadcast, setBroadcast] = useState<BroadcastState | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let cursor = 0;
    let initialized = false;

    const invalidateBracket = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bracket"] }),
        queryClient.invalidateQueries({ queryKey: ["tournament"] }),
        queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-tournament"] }),
      ]);
    };
    const invalidateChangedData = () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "admin-me",
      });
    };
    const applyEvent = (event: RealtimeEvent) => {
      if (event.type === "data.changed") {
        invalidateChangedData();
        return;
      }
      if (event.type === "draw.started" || event.type === "draw.reset") {
        if (event.data.draw) setBroadcast({ draw: event.data.draw });
        return;
      }
      if (
        event.type === "draw.spin" &&
        event.data.draw &&
        event.data.selectedParticipantId
      ) {
        setBroadcast({
          draw: event.data.draw,
          spin: {
            eventId: event.id,
            selectedParticipantId: event.data.selectedParticipantId,
            durationMs: event.data.durationMs ?? SPIN_DURATION_MS,
          },
        });
        return;
      }
      if (event.type === "draw.cancelled") {
        setBroadcast((current) =>
          current?.draw.tournamentId === event.data.tournamentId
            ? null
            : current,
        );
        return;
      }
      if (event.type === "draw.completed") {
        setBroadcast(null);
        invalidateBracket();
        return;
      }
      if (event.type === "bracket.updated") invalidateBracket();
    };

    const connect = async () => {
      let retryDelay = 1_000;
      while (!abortController.signal.aborted) {
        try {
          const response = await api.realtime(cursor, abortController.signal);
          const snapshot = response.data;
          if (!initialized && !snapshot.events.length) {
            const latest = [...snapshot.activeDraws].sort((left, right) =>
              right.updatedAt.localeCompare(left.updatedAt),
            )[0];
            if (latest) setBroadcast({ draw: latest });
          }
          for (const event of snapshot.events) applyEvent(event);
          cursor = snapshot.cursor;
          initialized = true;
          retryDelay = 1_000;
        } catch {
          await wait(retryDelay, abortController.signal);
          retryDelay = Math.min(retryDelay * 2, 10_000);
        }
      }
    };
    void connect();
    return () => abortController.abort();
  }, [queryClient]);

  if (location.pathname.startsWith("/admin") || !broadcast) return null;
  return <LiveDrawBroadcast state={broadcast} />;
}
