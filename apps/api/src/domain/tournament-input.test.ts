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

  it("accepts three unique tournament prize placements", () => {
    const result = tournamentUpdateInputSchema.parse({
      prizes: [
        {
          placement: 1,
          title: "Championship package",
          amount: "$5,000",
          imageUrl:
            "https://res.cloudinary.com/world-star/image/upload/prize.webp",
        },
        { placement: 2, title: "Runner-up package", amount: "$2,500" },
        { placement: 3, title: "Third-place package", amount: "$1,000" },
      ],
    });

    expect(result.prizes).toHaveLength(3);
    expect(result.prizes?.[0]?.placement).toBe(1);
  });

  it("rejects duplicate tournament prize placements", () => {
    expect(() =>
      tournamentUpdateInputSchema.parse({
        prizes: [
          { placement: 1, title: "First prize", amount: "$5,000" },
          { placement: 1, title: "Duplicate prize", amount: "$2,500" },
        ],
      }),
    ).toThrow("Each tournament placement can only have one prize.");
  });
});
