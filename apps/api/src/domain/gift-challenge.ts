export const GIFT_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1_000;

export function giftAvailableAt(claimedAt: Date | null): Date | null {
  return claimedAt
    ? new Date(claimedAt.getTime() + GIFT_CLAIM_WINDOW_MS)
    : null;
}

export function giftIsClaimed(
  claimedAt: Date | null,
  now = new Date(),
): boolean {
  const availableAt = giftAvailableAt(claimedAt);
  return availableAt !== null && availableAt > now;
}

export function publicGiftStatus(
  challenge: { claimedAt: Date | null; requiredClicks: number },
  now = new Date(),
) {
  const claimed = giftIsClaimed(challenge.claimedAt, now);
  return {
    claimed,
    requiredClicks: challenge.requiredClicks,
    nextAvailableAt: claimed ? giftAvailableAt(challenge.claimedAt) : null,
  };
}
