import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { BracketManager } from "./AdminPage";

vi.mock("@/lib/api", () => ({
  api: {
    adminTournaments: vi.fn(),
    adminTournament: vi.fn(),
    gangs: vi.fn(),
    reopenMatch: vi.fn(),
  },
}));

describe("BracketManager tournament selection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hides archived tournaments and selects an active tournament", async () => {
    vi.mocked(api.adminTournaments).mockResolvedValue({
      data: [
        {
          id: "archived-tournament",
          slug: "old-cup",
          name: "Old Cup",
          status: "ARCHIVED",
          maximumParticipants: 16,
        },
        {
          id: "active-tournament",
          slug: "current-cup",
          name: "Current Cup",
          status: "DRAFT",
          maximumParticipants: 16,
        },
      ],
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    vi.mocked(api.adminTournament).mockResolvedValue({
      data: {
        id: "active-tournament",
        slug: "current-cup",
        name: "Current Cup",
        status: "DRAFT",
        maximumParticipants: 16,
        participants: [],
        rounds: [],
      },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    vi.mocked(api.gangs).mockResolvedValue({
      data: [],
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <BracketManager />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("option", { name: "Current Cup" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Old Cup" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(api.adminTournament).toHaveBeenCalledWith("active-tournament"),
    );
  });

  it("returns an advanced winner to its match for a rematch", async () => {
    vi.mocked(api.adminTournaments).mockResolvedValue({
      data: [
        {
          id: "active-tournament",
          slug: "current-cup",
          name: "Current Cup",
          status: "IN_PROGRESS",
          maximumParticipants: 16,
        },
      ],
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    vi.mocked(api.adminTournament).mockResolvedValue({
      data: {
        id: "active-tournament",
        slug: "current-cup",
        name: "Current Cup",
        status: "IN_PROGRESS",
        maximumParticipants: 16,
        participants: [],
        rounds: [
          {
            id: "round-1",
            name: "Round of 16",
            matches: [
              {
                id: "match-1",
                position: 1,
                version: 4,
                status: "COMPLETED",
                gangAScore: 2,
                gangBScore: 1,
                winnerGangId: "gang-a",
                gangA: { id: "gang-a", name: "Alpha" },
                gangB: { id: "gang-b", name: "Bravo" },
              },
            ],
          },
        ],
      },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    vi.mocked(api.gangs).mockResolvedValue({
      data: [],
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    vi.mocked(api.reopenMatch).mockResolvedValue({
      data: {},
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <BracketManager />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Rematch" }));

    await waitFor(() =>
      expect(api.reopenMatch).toHaveBeenCalledWith("match-1", {
        version: 4,
        reason: "Bracket winner reversed by an administrator for a rematch.",
      }),
    );
  });
});
