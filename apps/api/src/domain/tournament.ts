import type { TournamentStatus } from "@mafia/shared";

export function canManageTournamentParticipants(
  status: TournamentStatus,
): boolean {
  return status !== "ARCHIVED";
}
