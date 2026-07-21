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
    vi.spyOn(window.crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint32Array)[0] = 0;
      return array;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("draws each gang once, creates pairings, and submits the exact order", () => {
    const onConfirm = vi.fn();
    render(
      <TournamentDrawWheel
        hasBracket={false}
        isSaving={false}
        participants={participants}
        tournamentName="World Star Cup"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole("button", {
      name: "Confirm draw & build bracket",
    });
    expect(confirm).toBeDisabled();

    for (const name of ["Alpha", "Bravo", "Charlie", "Delta"]) {
      fireEvent.click(screen.getByRole("button", { name: "Spin next gang" }));
      expect(screen.getByRole("button", { name: "Drawing…" })).toBeDisabled();
      act(() => {
        vi.advanceTimersByTime(3_000);
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
