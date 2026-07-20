import type { FastifyInstance } from "fastify";
import { matchResultSchema } from "@mafia/shared";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  assertValidWinner,
  generateOpeningRound,
  nextPowerOfTwo,
} from "../domain/bracket.js";
import { envelope } from "../lib/envelope.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { requirePermission } from "../middleware/authorize.js";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const recordStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "ARCHIVED",
]);
const httpsUrlSchema = z.url().refine((value) => value.startsWith("https://"), {
  message: "Only HTTPS URLs are allowed.",
});
const gangInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slugSchema,
  tag: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .transform((value) => value.toUpperCase()),
  motto: z.string().trim().max(180).optional(),
  description: z.string().trim().max(4000).optional(),
  logoUrl: z.url().optional(),
  bannerUrl: z.url().optional(),
  territory: z.string().trim().max(120).optional(),
  status: recordStatusSchema.default("ACTIVE"),
  recruitmentStatus: z
    .enum(["OPEN", "CLOSED", "INVITE_ONLY"])
    .default("CLOSED"),
  verified: z.boolean().default(false),
  featured: z.boolean().default(false),
});
const playerInputSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  slug: slugSchema,
  biography: z.string().trim().max(4000).optional(),
  avatarUrl: z.url().optional(),
  status: recordStatusSchema.default("ACTIVE"),
});
const tournamentInputSchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: slugSchema,
  description: z.string().trim().max(4000).optional(),
  format: z.enum([
    "SINGLE_ELIMINATION",
    "DOUBLE_ELIMINATION",
    "ROUND_ROBIN",
    "GROUP_KNOCKOUT",
    "CUSTOM",
  ]),
  status: z
    .enum([
      "DRAFT",
      "REGISTRATION_OPEN",
      "REGISTRATION_CLOSED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "ARCHIVED",
    ])
    .default("DRAFT"),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  maximumParticipants: z.number().int().min(2).max(256),
  rules: z.string().trim().max(20_000).optional(),
  prizeDescription: z.string().trim().max(1000).optional(),
});
const matchInputSchema = z.object({
  tournamentId: z.string().min(20).max(40).optional(),
  gangAId: z.string().min(20).max(40).optional(),
  gangBId: z.string().min(20).max(40).optional(),
  bestOf: z.number().int().min(1).max(15).default(1),
  scheduledAt: z.coerce.date().optional(),
});
const settingInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9._-]+$/),
  value: z.json(),
});
const participantInputSchema = z.object({
  gangId: z.string().min(20).max(40),
  seed: z.number().int().min(1).max(256).optional(),
});
const participantSeedSchema = z.object({
  seed: z.number().int().min(1).max(256),
});
const eventInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: slugSchema,
  description: z.string().trim().max(5000).optional(),
  imageUrl: httpsUrlSchema.optional(),
  location: z.string().trim().max(160).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  status: z
    .enum(["DRAFT", "SCHEDULED", "LIVE", "COMPLETED", "CANCELLED", "ARCHIVED"])
    .default("DRAFT"),
  featured: z.boolean().default(false),
});
const streamInputSchema = z.object({
  streamerName: z.string().trim().min(2).max(120),
  slug: slugSchema,
  platform: z.enum(["TWITCH", "YOUTUBE", "KICK", "OTHER"]),
  channelUrl: httpsUrlSchema,
  embedUrl: httpsUrlSchema.optional(),
  thumbnailUrl: httpsUrlSchema.optional(),
  status: z
    .enum(["SCHEDULED", "LIVE", "OFFLINE", "ARCHIVED"])
    .default("OFFLINE"),
  featured: z.boolean().default(false),
  tournamentId: z.string().min(20).max(40).optional(),
  startsAt: z.coerce.date().optional(),
});
const advanceMatchSchema = z.object({
  winnerGangId: z.string().min(20).max(40),
  gangAScore: z.number().int().min(0).max(99),
  gangBScore: z.number().int().min(0).max(99),
  version: z.number().int().min(0),
});

function bracketRoundName(roundNumber: number, totalRounds: number): string {
  const remaining = totalRounds - roundNumber + 1;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinals";
  if (remaining === 3) return "Quarterfinals";
  return `Round of ${String(2 ** remaining)}`;
}

function compact(input: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

async function recordAudit(
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  afterData: object,
): Promise<void> {
  await prisma.auditLog.create({
    data: { actorUserId, action, entityType, entityId, afterData },
  });
}

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

  app.post("/api/v1/admin/gangs", async (request, reply) => {
    const auth = requirePermission(request, "gang.create");
    const input = gangInputSchema.parse(request.body);
    const gang = await prisma.gang.create({
      data: compact(input) as Prisma.GangCreateInput,
    });
    await recordAudit(auth.userId, "gang.create", "Gang", gang.id, gang);
    return reply.code(201).send(envelope(request, gang));
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/gangs/:id",
    async (request) => {
      const auth = requirePermission(request, "gang.update.any");
      const input = gangInputSchema.partial().parse(request.body);
      const gang = await prisma.gang.update({
        where: { id: request.params.id },
        data: compact(input),
      });
      await recordAudit(auth.userId, "gang.update", "Gang", gang.id, gang);
      return envelope(request, gang);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/gangs/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "gang.update.any");
      const gang = await prisma.gang.update({
        where: { id: request.params.id },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      await recordAudit(auth.userId, "gang.archive", "Gang", gang.id, gang);
      return reply.code(204).send();
    },
  );

  app.post("/api/v1/admin/players", async (request, reply) => {
    const auth = requirePermission(request, "user.manage");
    const input = playerInputSchema.parse(request.body);
    const player = await prisma.player.create({
      data: compact(input) as Prisma.PlayerCreateInput,
    });
    await recordAudit(
      auth.userId,
      "player.create",
      "Player",
      player.id,
      player,
    );
    return reply.code(201).send(envelope(request, player));
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/players/:id",
    async (request) => {
      const auth = requirePermission(request, "user.manage");
      const input = playerInputSchema.partial().parse(request.body);
      const player = await prisma.player.update({
        where: { id: request.params.id },
        data: compact(input),
      });
      await recordAudit(
        auth.userId,
        "player.update",
        "Player",
        player.id,
        player,
      );
      return envelope(request, player);
    },
  );

  app.post("/api/v1/admin/tournaments", async (request, reply) => {
    const auth = requirePermission(request, "tournament.create");
    const input = tournamentInputSchema.parse(request.body);
    const tournament = await prisma.tournament.create({
      data: compact({
        ...input,
        organizerUserId: auth.userId,
      }) as Prisma.TournamentUncheckedCreateInput,
    });
    await recordAudit(
      auth.userId,
      "tournament.create",
      "Tournament",
      tournament.id,
      tournament,
    );
    return reply.code(201).send(envelope(request, tournament));
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id",
    async (request) => {
      const auth = requirePermission(request, "tournament.update");
      const input = tournamentInputSchema.partial().parse(request.body);
      const tournament = await prisma.tournament.update({
        where: { id: request.params.id },
        data: compact(input),
      });
      await recordAudit(
        auth.userId,
        "tournament.update",
        "Tournament",
        tournament.id,
        tournament,
      );
      return envelope(request, tournament);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id/participants",
    async (request, reply) => {
      const auth = requirePermission(request, "tournament.bracket.manage");
      const input = participantInputSchema.parse(request.body);
      const tournament = await prisma.tournament.findUnique({
        where: { id: request.params.id },
        select: { maximumParticipants: true },
      });
      if (!tournament)
        throw new HttpError(
          404,
          "TOURNAMENT_NOT_FOUND",
          "Tournament was not found.",
        );
      const count = await prisma.tournamentParticipant.count({
        where: {
          tournamentId: request.params.id,
          status: { not: "WITHDRAWN" },
        },
      });
      if (count >= tournament.maximumParticipants)
        throw new HttpError(
          409,
          "TOURNAMENT_FULL",
          "The tournament entrant capacity has been reached.",
        );
      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId: request.params.id,
          gangId: input.gangId,
          seed: input.seed ?? null,
          status: "APPROVED",
          approvedAt: new Date(),
        },
        include: { gang: true },
      });
      await recordAudit(
        auth.userId,
        "tournament.participant.add",
        "Tournament",
        request.params.id,
        participant,
      );
      return reply.code(201).send(envelope(request, participant));
    },
  );

  app.patch<{ Params: { id: string; participantId: string } }>(
    "/api/v1/admin/tournaments/:id/participants/:participantId",
    async (request) => {
      const auth = requirePermission(request, "tournament.bracket.manage");
      const input = participantSeedSchema.parse(request.body);
      const participant = await prisma.tournamentParticipant.update({
        where: {
          id: request.params.participantId,
          tournamentId: request.params.id,
        },
        data: { seed: input.seed, status: "APPROVED", approvedAt: new Date() },
        include: { gang: true },
      });
      await recordAudit(
        auth.userId,
        "tournament.participant.seed",
        "Tournament",
        request.params.id,
        participant,
      );
      return envelope(request, participant);
    },
  );

  app.delete<{ Params: { id: string; participantId: string } }>(
    "/api/v1/admin/tournaments/:id/participants/:participantId",
    async (request, reply) => {
      const auth = requirePermission(request, "tournament.bracket.manage");
      const participant = await prisma.tournamentParticipant.delete({
        where: {
          id: request.params.participantId,
          tournamentId: request.params.id,
        },
      });
      await recordAudit(
        auth.userId,
        "tournament.participant.remove",
        "Tournament",
        request.params.id,
        participant,
      );
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id/bracket/generate",
    async (request) => {
      const auth = requirePermission(request, "tournament.bracket.manage");
      const result = await prisma.$transaction(
        async (tx) => {
          const tournament = await tx.tournament.findUnique({
            where: { id: request.params.id },
            include: {
              participants: {
                where: { status: "APPROVED" },
                orderBy: [{ seed: "asc" }, { registeredAt: "asc" }],
              },
            },
          });
          if (!tournament)
            throw new HttpError(
              404,
              "TOURNAMENT_NOT_FOUND",
              "Tournament was not found.",
            );
          if (tournament.participants.length < 2)
            throw new HttpError(
              409,
              "BRACKET_TOO_SMALL",
              "Add at least two approved gangs before generating the bracket.",
            );

          const usedSeeds = new Set<number>();
          let nextSeed = 1;
          const seeded = tournament.participants.map((participant) => {
            let seed = participant.seed;
            if (seed === null || usedSeeds.has(seed)) {
              while (usedSeeds.has(nextSeed)) nextSeed += 1;
              seed = nextSeed;
            }
            usedSeeds.add(seed);
            return { participant, seed };
          });
          for (const entry of seeded) {
            if (entry.participant.seed !== entry.seed) {
              await tx.tournamentParticipant.update({
                where: { id: entry.participant.id },
                data: { seed: entry.seed },
              });
            }
          }

          const slotCount = nextPowerOfTwo(
            Math.max(tournament.maximumParticipants, seeded.length),
          );
          const roundCount = Math.log2(slotCount);
          const opening = generateOpeningRound(
            seeded.map(({ participant, seed }) => ({
              id: participant.id,
              seed,
            })),
          );
          const gangByParticipant = new Map(
            seeded.map(({ participant }) => [
              participant.id,
              participant.gangId,
            ]),
          );

          await tx.match.deleteMany({
            where: {
              tournamentId: tournament.id,
              bracketRoundId: { not: null },
            },
          });
          await tx.bracketRound.deleteMany({
            where: { tournamentId: tournament.id },
          });

          const roundMatches: Array<Array<{ id: string; position: number }>> =
            [];
          for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
            const roundNumber = roundIndex + 1;
            const round = await tx.bracketRound.create({
              data: {
                tournamentId: tournament.id,
                bracketType: "WINNERS",
                roundNumber,
                name: bracketRoundName(roundNumber, roundCount),
                sortOrder: roundNumber,
              },
            });
            const matchCount = slotCount / 2 ** roundNumber;
            const matches = [];
            for (let position = 1; position <= matchCount; position += 1) {
              const source =
                roundIndex === 0 ? opening[position - 1] : undefined;
              const gangAId = source?.participantAId
                ? (gangByParticipant.get(source.participantAId) ?? null)
                : null;
              const gangBId = source?.participantBId
                ? (gangByParticipant.get(source.participantBId) ?? null)
                : null;
              const byeWinnerId = source?.byeWinnerId
                ? (gangByParticipant.get(source.byeWinnerId) ?? null)
                : null;
              const match = await tx.match.create({
                data: {
                  tournamentId: tournament.id,
                  bracketRoundId: round.id,
                  position,
                  gangAId,
                  gangBId,
                  winnerGangId: byeWinnerId,
                  status: byeWinnerId ? "COMPLETED" : "SCHEDULED",
                  finalizedAt: byeWinnerId ? new Date() : null,
                },
                select: { id: true, position: true },
              });
              matches.push({
                id: match.id,
                position: match.position ?? position,
              });
            }
            roundMatches.push(matches);
          }

          for (
            let roundIndex = 0;
            roundIndex < roundMatches.length - 1;
            roundIndex += 1
          ) {
            const current = roundMatches[roundIndex] ?? [];
            const next = roundMatches[roundIndex + 1] ?? [];
            for (let index = 0; index < current.length; index += 1) {
              const currentMatch = current[index];
              const nextMatch = next[Math.floor(index / 2)];
              if (currentMatch && nextMatch) {
                await tx.match.update({
                  where: { id: currentMatch.id },
                  data: { nextMatchId: nextMatch.id },
                });
              }
            }
          }

          for (
            let roundIndex = 0;
            roundIndex < roundMatches.length - 1;
            roundIndex += 1
          ) {
            const matches = await tx.match.findMany({
              where: {
                id: {
                  in: (roundMatches[roundIndex] ?? []).map((match) => match.id),
                },
              },
              orderBy: { position: "asc" },
            });
            for (const match of matches) {
              const onlyGang =
                match.gangAId && !match.gangBId
                  ? match.gangAId
                  : match.gangBId && !match.gangAId
                    ? match.gangBId
                    : null;
              if (!onlyGang || !match.nextMatchId) continue;
              await tx.match.update({
                where: { id: match.id },
                data: {
                  winnerGangId: onlyGang,
                  status: "COMPLETED",
                  finalizedAt: new Date(),
                },
              });
              await tx.match.update({
                where: { id: match.nextMatchId },
                data:
                  match.position && match.position % 2 === 0
                    ? { gangBId: onlyGang }
                    : { gangAId: onlyGang },
              });
            }
          }

          const updated = await tx.tournament.update({
            where: { id: tournament.id },
            data: { bracketVersion: { increment: 1 } },
            select: { id: true, bracketVersion: true },
          });
          await tx.auditLog.create({
            data: {
              actorUserId: auth.userId,
              action: "tournament.bracket.generate",
              entityType: "Tournament",
              entityId: tournament.id,
              afterData: {
                slotCount,
                roundCount,
                bracketVersion: updated.bracketVersion,
              },
            },
          });
          return { ...updated, slotCount, roundCount };
        },
        { isolationLevel: "Serializable" },
      );
      return envelope(request, result);
    },
  );

  app.post("/api/v1/admin/matches", async (request, reply) => {
    const auth = requirePermission(request, "match.create");
    const input = matchInputSchema.parse(request.body);
    if (input.gangAId && input.gangBId && input.gangAId === input.gangBId) {
      throw new HttpError(
        422,
        "MATCH_GANGS_INVALID",
        "A gang cannot compete against itself.",
      );
    }
    const match = await prisma.match.create({
      data: compact(input),
    });
    await recordAudit(auth.userId, "match.create", "Match", match.id, match);
    return reply.code(201).send(envelope(request, match));
  });

  app.put("/api/v1/admin/settings", async (request) => {
    const auth = requirePermission(request, "settings.manage");
    const input = settingInputSchema.parse(request.body);
    const settingValue =
      input.value === null
        ? Prisma.JsonNull
        : (input.value as Prisma.InputJsonValue);
    const setting = await prisma.platformSetting.upsert({
      where: { key: input.key },
      update: { value: settingValue, updatedByUserId: auth.userId },
      create: {
        key: input.key,
        value: settingValue,
        updatedByUserId: auth.userId,
      },
    });
    await recordAudit(
      auth.userId,
      "setting.update",
      "PlatformSetting",
      setting.id,
      setting,
    );
    return envelope(request, setting);
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

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/matches/:id/advance",
    async (request) => {
      const auth = requirePermission(request, "match.finalize");
      const input = advanceMatchSchema.parse(request.body);
      const result = await prisma.$transaction(
        async (tx) => {
          const match = await tx.match.findUnique({
            where: { id: request.params.id },
          });
          if (!match)
            throw new HttpError(404, "MATCH_NOT_FOUND", "Match was not found.");
          if (match.version !== input.version)
            throw new HttpError(
              409,
              "VERSION_CONFLICT",
              "The match changed. Refresh before advancing a winner.",
            );
          assertValidWinner(match.gangAId, match.gangBId, input.winnerGangId);
          if (input.gangAScore === input.gangBScore)
            throw new HttpError(
              422,
              "WINNER_REQUIRED",
              "An elimination match cannot finish tied.",
            );
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
            await tx.match.update({
              where: { id: match.nextMatchId },
              data:
                match.position && match.position % 2 === 0
                  ? { gangBId: input.winnerGangId }
                  : { gangAId: input.winnerGangId },
            });
          }
          await tx.auditLog.create({
            data: {
              actorUserId: auth.userId,
              action: "match.advance",
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

  app.post("/api/v1/admin/events", async (request, reply) => {
    const auth = requirePermission(request, "event.manage");
    const input = eventInputSchema.parse(request.body);
    const event = await prisma.event.create({
      data: compact({
        ...input,
        createdByUserId: auth.userId,
      }) as Prisma.EventUncheckedCreateInput,
    });
    await recordAudit(auth.userId, "event.create", "Event", event.id, event);
    return reply.code(201).send(envelope(request, event));
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/events/:id",
    async (request) => {
      const auth = requirePermission(request, "event.manage");
      const input = eventInputSchema.partial().parse(request.body);
      const event = await prisma.event.update({
        where: { id: request.params.id },
        data: compact(input),
      });
      await recordAudit(auth.userId, "event.update", "Event", event.id, event);
      return envelope(request, event);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/events/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "event.manage");
      const event = await prisma.event.update({
        where: { id: request.params.id },
        data: { status: "ARCHIVED" },
      });
      await recordAudit(auth.userId, "event.archive", "Event", event.id, event);
      return reply.code(204).send();
    },
  );

  app.post("/api/v1/admin/live-streams", async (request, reply) => {
    const auth = requirePermission(request, "stream.manage");
    const input = streamInputSchema.parse(request.body);
    const stream = await prisma.liveStream.create({
      data: compact({
        ...input,
        createdByUserId: auth.userId,
      }) as Prisma.LiveStreamUncheckedCreateInput,
    });
    await recordAudit(
      auth.userId,
      "stream.create",
      "LiveStream",
      stream.id,
      stream,
    );
    return reply.code(201).send(envelope(request, stream));
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/live-streams/:id",
    async (request) => {
      const auth = requirePermission(request, "stream.manage");
      const input = streamInputSchema.partial().parse(request.body);
      const stream = await prisma.liveStream.update({
        where: { id: request.params.id },
        data: compact(input),
      });
      await recordAudit(
        auth.userId,
        "stream.update",
        "LiveStream",
        stream.id,
        stream,
      );
      return envelope(request, stream);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/live-streams/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "stream.manage");
      const stream = await prisma.liveStream.update({
        where: { id: request.params.id },
        data: { status: "ARCHIVED" },
      });
      await recordAudit(
        auth.userId,
        "stream.archive",
        "LiveStream",
        stream.id,
        stream,
      );
      return reply.code(204).send();
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
