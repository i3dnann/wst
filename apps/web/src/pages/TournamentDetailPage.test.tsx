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

vi.mock("@/components/effects/ChampionCelebration", () => ({
  ChampionCelebration: ({
    celebrationId,
    tournamentName,
    winnerName,
  }: {
    celebrationId: string;
    tournamentName: string;
    winnerName: string;
  }) => (
    <div data-testid="champion-celebration" data-celebration-id={celebrationId}>
      {winnerName} won {tournamentName}
    </div>
  ),
}));

const tournament = vi.mocked(api.tournament);
const bracket = vi.mocked(api.bracket);

function renderTournamentPage(rules: string | null, rounds: unknown[] = []) {
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
    data: { version: 7, rounds },
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

    const bracketHeading = screen.getByRole("heading", {
      name: "The bracket has not been seeded",
    });
    const rulesHeading = screen.getByRole("heading", {
      name: "Tournament Rules",
    });
    expect(
      bracketHeading.compareDocumentPosition(rulesHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the rules section visible before rules are published", async () => {
    renderTournamentPage(null);

    expect(
      await screen.findByText("Rules have not been published yet"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("celebrates the final winner even when bracket rounds arrive out of order", async () => {
    renderTournamentPage(null, [
      {
        id: "final-round",
        name: "Final",
        roundNumber: 2,
        matches: [
          {
            id: "final-match",
            position: 1,
            gangA: {
              id: "gang-blue",
              name: "Blue Vipers",
              logoUrl: null,
            },
            gangB: {
              id: "gang-north",
              name: "North Side",
              logoUrl: null,
            },
            gangAScore: 3,
            gangBScore: 1,
            winnerGangId: "gang-blue",
            status: "COMPLETED",
            scheduledAt: null,
          },
        ],
      },
      {
        id: "opening-round",
        name: "Semifinals",
        roundNumber: 1,
        matches: [],
      },
    ]);

    expect(
      await screen.findByText("Blue Vipers won World Star Cup"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("champion-celebration")).toHaveAttribute(
      "data-celebration-id",
      "world-star-cup:7:final-match:gang-blue",
    );
  });
});
