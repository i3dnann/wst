import { describe, expect, it } from "vitest";
import {
  assertValidWinner,
  generateOpeningRound,
  nextPowerOfTwo,
} from "./bracket.js";
import { canManageGang, type AuthorizationContext } from "./permissions.js";
import { calculatePoints, rankMovement } from "./ranking.js";

describe("ranking", () => {
  it("calculates authoritative points from auditable inputs", () => {
    expect(
      calculatePoints(
        {
          wins: 3,
          draws: 1,
          losses: 2,
          kills: 10,
          mvpAwards: 1,
          tournamentVictories: 1,
          adjustment: -2,
        },
        { win: 10, draw: 4, loss: 1, kill: 2, mvp: 5, tournamentVictory: 20 },
      ),
    ).toBe(79);
  });

  it("reports positive movement when a rank improves", () => {
    expect(rankMovement(2, 5)).toBe(3);
  });
});

describe("bracket generation", () => {
  it("rounds a field up to a power of two", () => {
    expect(nextPowerOfTwo(6)).toBe(8);
  });

  it("generates byes without duplicating participants", () => {
    const matches = generateOpeningRound([
      { id: "a", seed: 1 },
      { id: "b", seed: 2 },
      { id: "c", seed: 3 },
      { id: "d", seed: 4 },
      { id: "e", seed: 5 },
      { id: "f", seed: 6 },
    ]);
    expect(matches).toHaveLength(4);
    expect(matches.filter((match) => match.byeWinnerId)).toHaveLength(2);
    expect(
      new Set(
        matches
          .flatMap((match) => [match.participantAId, match.participantBId])
          .filter(Boolean),
      ).size,
    ).toBe(6);
  });

  it.each([2, 3, 4, 5, 8, 16, 32])(
    "creates the correct opening round for %i participants",
    (participantCount) => {
      const participants = Array.from(
        { length: participantCount },
        (_, index) => ({
          id: `gang-${String(index + 1)}`,
          seed: index + 1,
        }),
      );
      const matches = generateOpeningRound(participants);
      expect(matches).toHaveLength(nextPowerOfTwo(participantCount) / 2);
      expect(matches.filter((match) => match.byeWinnerId)).toHaveLength(
        nextPowerOfTwo(participantCount) - participantCount,
      );
      expect(
        matches
          .flatMap((match) => [match.participantAId, match.participantBId])
          .filter(Boolean),
      ).toHaveLength(participantCount);
    },
  );

  it("places standard seeds on opposite opening paths", () => {
    const matches = generateOpeningRound(
      Array.from({ length: 8 }, (_, index) => ({
        id: `gang-${String(index + 1)}`,
        seed: index + 1,
      })),
    );
    expect(
      matches.map((match) => [match.participantAId, match.participantBId]),
    ).toEqual([
      ["gang-1", "gang-8"],
      ["gang-4", "gang-5"],
      ["gang-2", "gang-7"],
      ["gang-3", "gang-6"],
    ]);
  });

  it("rejects duplicate participants, duplicate seeds, and missing seed numbers", () => {
    expect(() =>
      generateOpeningRound([
        { id: "gang-a", seed: 1 },
        { id: "gang-a", seed: 2 },
      ]),
    ).toThrowError("Participants and seeds must be unique");
    expect(() =>
      generateOpeningRound([
        { id: "gang-a", seed: 1 },
        { id: "gang-b", seed: 1 },
      ]),
    ).toThrowError("Participants and seeds must be unique");
    expect(() =>
      generateOpeningRound([
        { id: "gang-a", seed: 1 },
        { id: "gang-b", seed: 3 },
      ]),
    ).toThrowError("Seeds must use every number from 1 through 2");
  });

  it("prevents advancing a non-participant", () => {
    expect(() => {
      assertValidWinner("a", "b", "c");
    }).toThrowError("Winner must be one of the match participants");
  });
});

describe("gang scope", () => {
  it("allows an own-gang manager only inside the assigned scope", () => {
    const context: AuthorizationContext = {
      userId: "user",
      permissions: new Set(["gang.update.own"]),
      gangScopes: new Set(["gang-a"]),
    };
    expect(canManageGang(context, "gang-a")).toBe(true);
    expect(canManageGang(context, "gang-b")).toBe(false);
  });
});
