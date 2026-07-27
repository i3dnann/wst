import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import TournamentDetailPage from "./TournamentDetailPage";

vi.mock("@/lib/api", () => ({
  api: {
    tournament: vi.fn(),
    bracket: vi.fn(),
  },
}));

const tournament = vi.mocked(api.tournament);
const bracket = vi.mocked(api.bracket);

function renderTournamentPage(rules: string | null) {
  tournament.mockResolvedValue({
    data: {
      name: "World Star Cup",
      description: "Sixteen gangs compete for the title.",
      format: "SINGLE_ELIMINATION",
      status: "REGISTRATION_OPEN",
      startAt: "2026-08-12T18:00:00.000Z",
      endAt: null,
      maximumParticipants: 16,
      participants: [],
      rules,
    },
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  bracket.mockResolvedValue({
    data: { version: 0, rounds: [] },
    meta: { requestId: "test", timestamp: new Date().toISOString() },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/tournaments/world-star-cup"]}>
        <Routes>
          <Route path="/tournaments/:slug" element={<TournamentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TournamentDetailPage rules", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("publishes tournament rules as a numbered guide", async () => {
    renderTournamentPage(
      "1. Check in 15 minutes early.\n- Respect administrator decisions.",
    );

    expect(
      await screen.findByRole("heading", { name: "Tournament Rules" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 rules")).toBeInTheDocument();
    expect(screen.getByText("Check in 15 minutes early.")).toBeInTheDocument();
    expect(
      screen.getByText("Respect administrator decisions."),
    ).toBeInTheDocument();
  });

  it("keeps the rules section visible before rules are published", async () => {
    renderTournamentPage(null);

    expect(
      await screen.findByText("Rules have not been published yet"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});
