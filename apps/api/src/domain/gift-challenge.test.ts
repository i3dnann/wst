import { describe, expect, it } from "vitest";
import {
  GIFT_CLAIM_WINDOW_MS,
  giftIsClaimed,
  publicGiftStatus,
} from "./gift-challenge.js";

describe("daily gift challenge", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");

  it("keeps a claim closed for exactly 24 hours", () => {
    const recent = new Date(now.getTime() - GIFT_CLAIM_WINDOW_MS + 1);
    const expired = new Date(now.getTime() - GIFT_CLAIM_WINDOW_MS);
    expect(giftIsClaimed(recent, now)).toBe(true);
    expect(giftIsClaimed(expired, now)).toBe(false);
  });

  it("never includes the secret code in the public status", () => {
    const status = publicGiftStatus(
      { claimedAt: new Date("2026-08-05T11:00:00.000Z"), requiredClicks: 100 },
      now,
    );
    expect(status).toEqual({
      claimed: true,
      requiredClicks: 100,
      nextAvailableAt: new Date("2026-08-06T11:00:00.000Z"),
    });
    expect(status).not.toHaveProperty("code");
  });
});
