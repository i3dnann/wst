import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MatchDetail, PlayerList } from "./DirectoryPage";

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

describe("PlayerList gang categories", () => {
  it("filters members by gang and disables the category when clicked again", () => {
    render(
      <MemoryRouter>
        <PlayerList
          rows={[
            {
              id: "player-1",
              slug: "one",
              displayName: "Player One",
              status: "ACTIVE",
              memberships: [
                { id: "membership-1", gang: { id: "gang-a", name: "Alpha" } },
              ],
              seasonStats: [],
            },
            {
              id: "player-2",
              slug: "two",
              displayName: "Player Two",
              status: "ACTIVE",
              memberships: [
                { id: "membership-2", gang: { id: "gang-b", name: "Bravo" } },
              ],
              seasonStats: [],
            },
          ]}
        />
      </MemoryRouter>,
    );

    const alphaCategory = screen.getByRole("button", { name: "Alpha 1" });
    fireEvent.click(alphaCategory);

    expect(screen.getByRole("heading", { name: "Player One" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Player Two" }),
    ).not.toBeInTheDocument();
    expect(alphaCategory).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(alphaCategory);

    expect(screen.getByRole("heading", { name: "Player One" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Player Two" })).toBeVisible();
    expect(alphaCategory).toHaveAttribute("aria-pressed", "false");
  });
});
