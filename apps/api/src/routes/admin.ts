import type { FastifyInstance } from "fastify";
import { matchResultSchema } from "@mafia/shared";
import { assertValidWinner } from "../domain/bracket.js";
import { envelope } from "../lib/envelope.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { requirePermission } from "../middleware/authorize.js";

export function adminRoutes(app: FastifyInstance): void {
  app.get("/api/v1/admin/overview", async (request) => {
    requirePermission(request, "audit.read");
    const [
      totalGangs,
      activeGangs,
      totalPlayers,
      activeTournaments,
      upcomingMatches,
      awaitingResults,
      disputedMatches,
      pendingMedia,
      activity,
    ] = await Promise.all([
      prisma.gang.count(),
      prisma.gang.count({ where: { status: "ACTIVE" } }),
      prisma.player.count(),
      prisma.tournament.count({ where: { status: "IN_PROGRESS" } }),
      prisma.match.count({
        where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      }),
      prisma.match.count({ where: { status: "AWAITING_RESULT" } }),
      prisma.match.count({ where: { status: "DISPUTED" } }),
      prisma.mediaAsset.count({ where: { status: "PENDING" } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { actor: { select: { displayName: true } } },
      }),
    ]);
    return envelope(request, {
      summary: {
        totalGangs,
        activeGangs,
        totalPlayers,
        activeTournaments,
        upcomingMatches,
        awaitingResults,
        disputedMatches,
        pendingMedia,
      },
      activity,
    });
  });

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/matches/:id/finalize",
    async (request) => {
      const auth = requirePermission(request, "match.finalize");
      const input = matchResultSchema.parse(request.body);
      const result = await prisma.$transaction(
        async (tx) => {
          const match = await tx.match.findUnique({
            where: { id: request.params.id },
          });
          if (!match)
            throw new HttpError(404, "MATCH_NOT_FOUND", "Match was not found.");
          if (match.status === "COMPLETED")
            throw new HttpError(
              409,
              "MATCH_ALREADY_FINALIZED",
              "This match has already been finalized.",
            );
          if (match.version !== input.version)
            throw new HttpError(
              409,
              "VERSION_CONFLICT",
              "The match changed. Refresh before finalizing.",
            );
          assertValidWinner(match.gangAId, match.gangBId, input.winnerGangId);
          if (input.gangAScore === input.gangBScore)
            throw new HttpError(
              422,
              "WINNER_REQUIRED",
              "A finalized elimination match cannot be tied.",
            );

          await tx.matchPlayerStat.createMany({
            data: input.playerStats.map((stat) => ({
              ...stat,
              matchId: match.id,
            })),
          });
          const updated = await tx.match.update({
            where: { id: match.id, version: input.version },
            data: {
              gangAScore: input.gangAScore,
              gangBScore: input.gangBScore,
              winnerGangId: input.winnerGangId,
              status: "COMPLETED",
              finalizedAt: new Date(),
              finalizedByUserId: auth.userId,
              version: { increment: 1 },
            },
          });
          if (match.nextMatchId) {
            const next = await tx.match.findUnique({
              where: { id: match.nextMatchId },
            });
            if (!next)
              throw new HttpError(
                409,
                "BRACKET_PATH_INVALID",
                "Next bracket match does not exist.",
              );
            const data = next.gangAId
              ? next.gangBId
                ? null
                : { gangBId: input.winnerGangId }
              : { gangAId: input.winnerGangId };
            if (!data)
              throw new HttpError(
                409,
                "BRACKET_SLOT_OCCUPIED",
                "The next bracket match is already full.",
              );
            await tx.match.update({ where: { id: next.id }, data });
          }
          await tx.auditLog.create({
            data: {
              actorUserId: auth.userId,
              action: "match.finalize",
              entityType: "Match",
              entityId: match.id,
              beforeData: match,
              afterData: updated,
            },
          });
          return updated;
        },
        { isolationLevel: "Serializable" },
      );
      return envelope(request, result);
    },
  );

  app.get("/api/v1/admin/audit-logs", async (request) => {
    requirePermission(request, "audit.read");
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { id: true, displayName: true } } },
    });
    return envelope(request, logs);
  });
}
