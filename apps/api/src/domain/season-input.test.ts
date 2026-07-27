import { describe, expect, it } from "vitest";
import { seasonInputSchema, seasonUpdateInputSchema } from "./season-input.js";

const scoringConfigSnapshot = {
  win: 3,
  draw: 1,
  loss: 0,
  kill: 1,
  mvp: 3,
  tournamentVictory: 20,
};

describe("season input schemas", () => {
  it("accepts a status-only update without injecting other fields", () => {
    expect(seasonUpdateInputSchema.parse({ status: "ACTIVE" })).toEqual({
      status: "ACTIVE",
    });
  });

  it("keeps the draft default for season creation", () => {
    const result = seasonInputSchema.parse({
      name: "World Star 2026",
      slug: "world-star-2026",
      startsAt: "2026-07-22T00:00:00.000Z",
      scoringConfigSnapshot,
    });

    expect(result.status).toBe("DRAFT");
  });

  it("rejects an invalid complete season date range", () => {
    expect(() =>
      seasonInputSchema.parse({
        name: "World Star 2026",
        slug: "world-star-2026",
        startsAt: "2026-07-22T00:00:00.000Z",
        endsAt: "2026-07-21T00:00:00.000Z",
        scoringConfigSnapshot,
      }),
    ).toThrow("Season end time must be after its start time.");
  });
});
