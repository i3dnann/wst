import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LiveDrawParticipant, LiveTournamentDraw } from "@/lib/api";
import { LiveDrawBroadcast } from "./RealtimeBridge";

const participants: LiveDrawParticipant[] = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
].map((name, index) => ({
  id: `participant-${String(index + 1)}`,
  gang: {
    id: `gang-${String(index + 1)}`,
    name,
    tag: name.slice(0, 3).toUpperCase(),
    logoUrl: null,
  },
}));

const draw = (drawnParticipantIds: string[]): LiveTournamentDraw => ({
  tournamentId: "tournament-1",
  tournamentSlug: "world-star-cup",
  tournamentName: "World Star Cup",
  participants,
  drawnParticipantIds,
  updatedAt: new Date().toISOString(),
});

describe("LiveDrawBroadcast", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("presents live progress and confirmed opening matchups", () => {
    render(
      <MemoryRouter>
        <LiveDrawBroadcast
          state={{
            draw: draw(participants.map(({ id }) => id)),
          }}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("progressbar", { name: "Tournament draw progress" }),
    ).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByText("2 of 2 confirmed")).toBeInTheDocument();
    expect(screen.getByText("Latest selection")).toBeInTheDocument();
    expect(screen.getAllByText("Delta").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /view bracket/i })).toHaveAttribute(
      "href",
      "/tournaments/world-star-cup",
    );
  });

  it("shows the authoritative spin before revealing the selected gang", () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <LiveDrawBroadcast
          state={{
            draw: draw(participants.slice(0, 3).map(({ id }) => id)),
            spin: {
              eventId: 42,
              selectedParticipantId: participants[2]?.id ?? "",
              durationMs: 8_000,
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Wheel spinning…")).toBeInTheDocument();
    expect(screen.getByText("Selecting")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Tournament draw progress" }),
    ).toHaveAttribute("aria-valuenow", "2");

    act(() => {
      vi.advanceTimersByTime(8_000);
    });

    expect(screen.getByText("Latest selection")).toBeInTheDocument();
    expect(screen.getAllByText("Charlie").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("progressbar", { name: "Tournament draw progress" }),
    ).toHaveAttribute("aria-valuenow", "3");
  });
});
