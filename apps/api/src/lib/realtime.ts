import { randomInt } from "node:crypto";

export const LIVE_DRAW_SPIN_DURATION_MS = 8_000;
const EVENT_BUFFER_SIZE = 200;
const POLL_TIMEOUT_MS = 18_000;

export interface LiveDrawParticipant {
  id: string;
  gang: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
  };
}

export interface LiveTournamentDraw {
  tournamentId: string;
  tournamentSlug: string;
  tournamentName: string;
  participants: LiveDrawParticipant[];
  drawnParticipantIds: string[];
  updatedAt: string;
}

export type RealtimeEvent = {
  id: number;
  type:
    | "draw.started"
    | "draw.spin"
    | "draw.reset"
    | "draw.cancelled"
    | "draw.completed"
    | "bracket.updated";
  timestamp: string;
  data: Record<string, unknown>;
};

export interface RealtimeSnapshot {
  cursor: number;
  events: RealtimeEvent[];
  activeDraws: LiveTournamentDraw[];
}

export type DrawConfirmationIssue =
  | "DRAW_NOT_ACTIVE"
  | "DRAW_INCOMPLETE"
  | "DRAW_ORDER_MISMATCH";

export function drawConfirmationIssue(
  draw: LiveTournamentDraw | null,
  placement: "SEEDED" | "RANDOM" | "DRAW",
  submittedParticipantIds: string[] | undefined,
): DrawConfirmationIssue | null {
  if (!draw || placement !== "DRAW") return "DRAW_NOT_ACTIVE";
  if (draw.drawnParticipantIds.length !== draw.participants.length)
    return "DRAW_INCOMPLETE";
  if (
    !submittedParticipantIds ||
    submittedParticipantIds.length !== draw.drawnParticipantIds.length ||
    submittedParticipantIds.some(
      (participantId, index) =>
        participantId !== draw.drawnParticipantIds[index],
    )
  )
    return "DRAW_ORDER_MISMATCH";
  return null;
}

function cloneDraw(draw: LiveTournamentDraw): LiveTournamentDraw {
  return {
    ...draw,
    participants: draw.participants.map((participant) => ({
      ...participant,
      gang: { ...participant.gang },
    })),
    drawnParticipantIds: [...draw.drawnParticipantIds],
  };
}

class RealtimeHub {
  private cursor = 0;
  private readonly events: RealtimeEvent[] = [];
  private readonly activeDraws = new Map<string, LiveTournamentDraw>();
  private readonly waiters = new Set<() => void>();

  publish(
    type: RealtimeEvent["type"],
    data: Record<string, unknown>,
  ): RealtimeEvent {
    const event = {
      id: ++this.cursor,
      type,
      timestamp: new Date().toISOString(),
      data,
    } satisfies RealtimeEvent;
    this.events.push(event);
    if (this.events.length > EVENT_BUFFER_SIZE) this.events.shift();
    for (const wake of this.waiters) wake();
    this.waiters.clear();
    return event;
  }

  startDraw(
    draw: Omit<LiveTournamentDraw, "drawnParticipantIds" | "updatedAt">,
  ): LiveTournamentDraw {
    const started = {
      ...draw,
      drawnParticipantIds: [],
      updatedAt: new Date().toISOString(),
    } satisfies LiveTournamentDraw;
    this.activeDraws.set(started.tournamentId, started);
    this.publish("draw.started", { draw: cloneDraw(started) });
    return cloneDraw(started);
  }

  spinDraw(tournamentId: string): {
    draw: LiveTournamentDraw;
    selectedParticipantId: string;
    durationMs: number;
  } | null {
    const draw = this.activeDraws.get(tournamentId);
    if (!draw) return null;
    const drawn = new Set(draw.drawnParticipantIds);
    const remaining = draw.participants.filter(
      (participant) => !drawn.has(participant.id),
    );
    if (!remaining.length) return null;
    const selected = remaining[randomInt(remaining.length)];
    if (!selected) return null;
    const updated = {
      ...draw,
      drawnParticipantIds: [...draw.drawnParticipantIds, selected.id],
      updatedAt: new Date().toISOString(),
    } satisfies LiveTournamentDraw;
    this.activeDraws.set(tournamentId, updated);
    const result = {
      draw: cloneDraw(updated),
      selectedParticipantId: selected.id,
      durationMs: LIVE_DRAW_SPIN_DURATION_MS,
    };
    this.publish("draw.spin", result);
    return result;
  }

  resetDraw(tournamentId: string): LiveTournamentDraw | null {
    const draw = this.activeDraws.get(tournamentId);
    if (!draw) return null;
    const reset = {
      ...draw,
      drawnParticipantIds: [],
      updatedAt: new Date().toISOString(),
    };
    this.activeDraws.set(tournamentId, reset);
    this.publish("draw.reset", { draw: cloneDraw(reset) });
    return cloneDraw(reset);
  }

  cancelDraw(tournamentId: string): void {
    const draw = this.activeDraws.get(tournamentId);
    if (!draw) return;
    this.activeDraws.delete(tournamentId);
    this.publish("draw.cancelled", {
      tournamentId,
      tournamentSlug: draw.tournamentSlug,
    });
  }

  completeDraw(
    tournamentId: string,
    tournamentSlug: string,
    bracketVersion: number,
  ): void {
    const draw = this.activeDraws.get(tournamentId);
    if (draw) {
      this.activeDraws.delete(tournamentId);
      this.publish("draw.completed", {
        draw: cloneDraw(draw),
        bracketVersion,
      });
    }
    this.publish("bracket.updated", {
      tournamentId,
      tournamentSlug,
      bracketVersion,
    });
  }

  getDraw(tournamentId: string): LiveTournamentDraw | null {
    const draw = this.activeDraws.get(tournamentId);
    return draw ? cloneDraw(draw) : null;
  }

  async poll(cursor: number, signal?: AbortSignal): Promise<RealtimeSnapshot> {
    if (!this.events.some((event) => event.id > cursor) && !signal?.aborted) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          this.waiters.delete(finish);
          signal?.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, POLL_TIMEOUT_MS);
        this.waiters.add(finish);
        signal?.addEventListener("abort", finish, { once: true });
      });
    }
    return {
      cursor: this.cursor,
      events: this.events.filter((event) => event.id > cursor),
      activeDraws: [...this.activeDraws.values()].map(cloneDraw),
    };
  }

  resetForTests(): void {
    this.cursor = 0;
    this.events.length = 0;
    this.activeDraws.clear();
    for (const wake of this.waiters) wake();
    this.waiters.clear();
  }
}

export const realtimeHub = new RealtimeHub();
