import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TournamentDrawWheel,
  type DrawParticipant,
} from "./TournamentDrawWheel";

const participants: DrawParticipant[] = [
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

describe("TournamentDrawWheel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders authoritative spins, creates pairings, and submits the exact order", async () => {
    const onConfirm = vi.fn();
    let spinIndex = 0;
    const onSpin = vi.fn(() => {
      spinIndex += 1;
      return Promise.resolve({
        draw: {
          tournamentId: "tournament-1",
          tournamentSlug: "world-star-cup",
          tournamentName: "World Star Cup",
          participants,
          drawnParticipantIds: participants
            .slice(0, spinIndex)
            .map(({ id }) => id),
          updatedAt: new Date().toISOString(),
        },
        selectedParticipantId: participants[spinIndex - 1]?.id ?? "",
        durationMs: 8_000,
      });
    });
    render(
      <TournamentDrawWheel
        hasBracket={false}
        isSaving={false}
        participants={participants}
        tournamentName="World Star Cup"
        onClose={vi.fn()}
        onConfirm={onConfirm}
        onError={vi.fn()}
        onReset={vi.fn(() =>
          Promise.resolve({
            tournamentId: "tournament-1",
            tournamentSlug: "world-star-cup",
            tournamentName: "World Star Cup",
            participants,
            drawnParticipantIds: [],
            updatedAt: new Date().toISOString(),
          }),
        )}
        onSpin={onSpin}
      />,
    );

    const confirm = screen.getByRole("button", {
      name: "Confirm draw & build bracket",
    });
    expect(confirm).toBeDisabled();

    for (const name of ["Alpha", "Bravo", "Charlie", "Delta"]) {
      fireEvent.click(screen.getByRole("button", { name: "Spin next gang" }));
      await act(() => Promise.resolve());
      expect(screen.getByRole("button", { name: "Drawing…" })).toBeDisabled();
      act(() => {
        vi.advanceTimersByTime(8_000);
      });
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }

    expect(
      screen.getByRole("button", { name: "Draw complete" }),
    ).toBeDisabled();
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(participants.map(({ id }) => id));
  });
});
