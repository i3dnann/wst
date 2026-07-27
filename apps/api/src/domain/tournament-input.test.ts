import { describe, expect, it } from "vitest";
import {
  tournamentInputSchema,
  tournamentUpdateInputSchema,
} from "./tournament-input.js";

describe("tournament input schemas", () => {
  it("does not inject create defaults into an update payload", () => {
    expect(tournamentUpdateInputSchema.parse({ name: "Updated Cup" })).toEqual({
      name: "Updated Cup",
    });
    expect(tournamentUpdateInputSchema.parse({})).toEqual({});
  });

  it("keeps defaults and date validation for tournament creation", () => {
    const result = tournamentInputSchema.parse({
      name: "World Star Cup",
      slug: "world-star-cup",
      format: "SINGLE_ELIMINATION",
      startAt: "2026-08-01T18:00:00.000Z",
      maximumParticipants: 16,
    });

    expect(result.status).toBe("DRAFT");
    expect(result.featured).toBe(false);
    expect(result.publicVisible).toBe(true);
  });

  it("rejects invalid complete tournament date ranges", () => {
    expect(() =>
      tournamentInputSchema.parse({
        name: "World Star Cup",
        slug: "world-star-cup",
        format: "SINGLE_ELIMINATION",
        startAt: "2026-08-01T18:00:00.000Z",
        endAt: "2026-08-01T17:00:00.000Z",
        maximumParticipants: 16,
      }),
    ).toThrow("End time must be after the start time.");
  });
});
