import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import GangsPage from "./GangsPage";

vi.mock("@/lib/api", () => ({
  api: {
    gangs: vi.fn(),
  },
}));

const gangs = vi.mocked(api.gangs);

describe("GangsPage background refresh", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("keeps the last successful registry visible when a refresh fails", async () => {
    gangs
      .mockResolvedValueOnce({
        data: [
          {
            id: "gang-identifier-00000001",
            slug: "crimson-syndicate",
            name: "Crimson Syndicate",
            tag: "CS",
            motto: "Loyalty above all",
            logoUrl: null,
            bannerUrl: null,
            status: "ACTIVE",
            recruitmentStatus: "CLOSED",
            verified: true,
            featured: false,
            currentRank: 1,
            previousRank: 2,
            peakRank: 1,
            memberCount: 12,
            matchesPlayed: 4,
            wins: 3,
            losses: 1,
            kills: 0,
            winRate: 75,
            trophies: 1,
            points: 12,
            streak: 2,
            killDifference: 0,
          },
        ],
        meta: {
          requestId: "test",
          timestamp: new Date().toISOString(),
          total: 1,
        },
      })
      .mockRejectedValueOnce(new Error("Temporary refresh failure"));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GangsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Crimson Syndicate" }),
    ).toBeInTheDocument();

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["gangs"] });
    });

    expect(gangs).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("heading", { name: "Crimson Syndicate" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/showing the last available registry/i),
    ).toBeInTheDocument();
  });
});
