import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { BracketManager } from "./AdminPage";

vi.mock("@/lib/api", () => ({
  api: {
    adminTournaments: vi.fn(),
    adminTournament: vi.fn(),
    gangs: vi.fn(),
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
});
