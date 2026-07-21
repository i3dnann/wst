import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import confetti from "canvas-confetti";
import { ChampionCelebration } from "./ChampionCelebration";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(() => Promise.resolve(null)),
}));

describe("ChampionCelebration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(confetti).mockClear();
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
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("dismisses after the animation and celebrates again after a remount", () => {
    const props = {
      celebrationId: "demo-final:crimson",
      tournamentName: "World Star Demo Cup",
      winnerName: "Crimson Syndicate",
    };
    const first = render(
      <StrictMode>
        <ChampionCelebration {...props} />
      </StrictMode>,
    );

    expect(screen.getByText("Crimson Syndicate")).toBeInTheDocument();
    expect(confetti).toHaveBeenCalled();
    const confettiCallsAfterMount = vi.mocked(confetti).mock.calls.length;

    first.rerender(
      <StrictMode>
        <ChampionCelebration {...props} />
      </StrictMode>,
    );
    expect(vi.mocked(confetti).mock.calls).toHaveLength(
      confettiCallsAfterMount,
    );

    act(() => {
      vi.advanceTimersByTime(4_200);
    });
    expect(screen.queryByText("Crimson Syndicate")).not.toBeInTheDocument();

    first.unmount();
    render(<ChampionCelebration {...props} />);
    expect(screen.getByText("Crimson Syndicate")).toBeInTheDocument();
  });
});
