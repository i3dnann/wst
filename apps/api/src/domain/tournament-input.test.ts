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

  it("accepts multiple ordered reward items for each tournament placement", () => {
    const result = tournamentUpdateInputSchema.parse({
      prizes: [
        {
          placement: 1,
          itemOrder: 0,
          title: "Championship package",
          amount: "$5,000",
          imageUrl:
            "https://res.cloudinary.com/world-star/image/upload/prize.webp",
        },
        {
          placement: 1,
          itemOrder: 1,
          title: "Custom vehicle",
          amount: "1 vehicle",
        },
        {
          placement: 2,
          itemOrder: 0,
          title: "Runner-up package",
          amount: "$2,500",
        },
        {
          placement: 3,
          itemOrder: 0,
          title: "Third-place package",
          amount: "$1,000",
        },
      ],
    });

    expect(result.prizes).toHaveLength(4);
    expect(result.prizes?.[0]?.placement).toBe(1);
    expect(result.prizes?.[1]?.itemOrder).toBe(1);
  });

  it("rejects duplicate reward item order within a placement", () => {
    expect(() =>
      tournamentUpdateInputSchema.parse({
        prizes: [
          {
            placement: 1,
            itemOrder: 0,
            title: "First prize",
            amount: "$5,000",
          },
          {
            placement: 1,
            itemOrder: 0,
            title: "Duplicate prize",
            amount: "$2,500",
          },
        ],
      }),
    ).toThrow(
      "Each reward item must have a unique order within its placement.",
    );
  });
});
