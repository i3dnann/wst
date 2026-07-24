import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MatchDetail } from "./DirectoryPage";

afterEach(cleanup);

describe("MatchDetail", () => {
  it("presents the finalized score, winner, and statistics state", () => {
    render(
      <MatchDetail
        row={{
          id: "match-1",
          status: "COMPLETED",
          gangAScore: 2,
          gangBScore: 1,
          gangA: { id: "bullet", name: "Bullet", tag: "BULLET" },
          gangB: { id: "cloud", name: "Cloud", tag: "CLOUD" },
          winnerGang: { id: "bullet", name: "Bullet" },
          tournament: { id: "tournament-1", name: "testtt" },
          bracketRound: { id: "round-1", name: "Round of 16" },
          playerStats: [],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Match Record" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Bullet won")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
    expect(
      screen.getByText("No player statistics published"),
    ).toBeInTheDocument();
  });
});
