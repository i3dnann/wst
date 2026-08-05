import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatchCountdown } from "./MatchCountdown";

describe("MatchCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T12:00:00.000Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("counts down an upcoming match every second", async () => {
    render(<MatchCountdown scheduledAt="2026-08-06T13:02:03.000Z" />);

    expect(screen.getByLabelText(/Match starts in 1 days, 1 hours, 2 minutes, and 3 seconds/)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(screen.getByLabelText(/and 2 seconds/)).toBeInTheDocument();
  });

  it("does not render for a past match", () => {
    const { container } = render(<MatchCountdown scheduledAt="2026-08-05T11:59:59.000Z" />);
    expect(container).toBeEmptyDOMElement();
  });
});
