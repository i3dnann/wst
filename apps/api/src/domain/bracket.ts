import { HttpError } from "../lib/http-error.js";

export interface SeededParticipant {
  id: string;
  seed: number;
}

export interface GeneratedMatch {
  position: number;
  participantAId: string | null;
  participantBId: string | null;
  byeWinnerId: string | null;
}

export function nextPowerOfTwo(value: number): number {
  if (value < 2) return 2;
  return 2 ** Math.ceil(Math.log2(value));
}

export function generateOpeningRound(
  participants: SeededParticipant[],
): GeneratedMatch[] {
  if (participants.length < 2)
    throw new HttpError(
      409,
      "BRACKET_TOO_SMALL",
      "At least two approved participants are required.",
    );
  const uniqueIds = new Set(participants.map((participant) => participant.id));
  const uniqueSeeds = new Set(
    participants.map((participant) => participant.seed),
  );
  if (
    uniqueIds.size !== participants.length ||
    uniqueSeeds.size !== participants.length
  ) {
    throw new HttpError(
      409,
      "DUPLICATE_SEED",
      "Participants and seeds must be unique.",
    );
  }

  const sorted = [...participants].sort((a, b) => a.seed - b.seed);
  const size = nextPowerOfTwo(sorted.length);
  const slots: Array<SeededParticipant | null> = [
    ...sorted,
    ...Array<null>(size - sorted.length).fill(null),
  ];
  const matches: GeneratedMatch[] = [];

  for (let index = 0; index < size / 2; index += 1) {
    const a = slots[index] ?? null;
    const b = slots[size - 1 - index] ?? null;
    matches.push({
      position: index + 1,
      participantAId: a?.id ?? null,
      participantBId: b?.id ?? null,
      byeWinnerId: a && !b ? a.id : b && !a ? b.id : null,
    });
  }
  return matches;
}

export function assertValidWinner(
  gangAId: string | null,
  gangBId: string | null,
  winnerGangId: string,
): void {
  if (winnerGangId !== gangAId && winnerGangId !== gangBId) {
    throw new HttpError(
      422,
      "INVALID_WINNER",
      "Winner must be one of the match participants.",
    );
  }
}
