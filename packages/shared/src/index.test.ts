import { describe, expect, it } from "vitest";
import { gangListQuerySchema, matchResultSchema } from "./index.js";

describe("shared API contracts", () => {
  it("normalizes public pagination safely", () => {
    expect(
      gangListQuerySchema.parse({ page: "2", pageSize: "25" }),
    ).toMatchObject({ page: 2, pageSize: 25, sort: "rank" });
  });

  it("rejects an invalid match result before it reaches the service", () => {
    expect(
      matchResultSchema.safeParse({
        version: 0,
        gangAScore: -1,
        gangBScore: 0,
        winnerGangId: "bad",
        playerStats: [],
      }).success,
    ).toBe(false);
  });
});
