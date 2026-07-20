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
import {
  discordAuditCategories,
  discordAuditSettingKey,
  executeDiscordWebhook,
  getDiscordAuditConfig,
  maskWebhookUrl,
  recordAudit as writeAudit,
} from "../lib/audit.js";
import { HttpError } from "../lib/http-error.js";
import { hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { refreshStreamStatus } from "../lib/stream-status.js";
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
  providerChannelId: z.string().trim().max(255).optional(),
  autoDetect: z.boolean().default(true),
  status: z
    .enum(["SCHEDULED", "LIVE", "OFFLINE", "ARCHIVED"])
    .default("OFFLINE"),
  featured: z.boolean().default(false),
  tournamentId: z.string().min(20).max(40).optional(),
  startsAt: z.coerce.date().optional(),
});
const matchUpdateSchema = z.object({
  tournamentId: z.string().min(20).max(40).nullable().optional(),
  gangAId: z.string().min(20).max(40).nullable().optional(),
  gangBId: z.string().min(20).max(40).nullable().optional(),
  bestOf: z.number().int().min(1).max(15).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  status: z
    .enum([
      "SCHEDULED",
      "CHECK_IN",
      "LIVE",
      "AWAITING_RESULT",
      "DISPUTED",
      "COMPLETED",
      "CANCELLED",
      "FORFEIT",
    ])
    .optional(),
});
const administratorCreateSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
});
const administratorUpdateSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase())
    .optional(),
  displayName: z.string().trim().min(2).max(100).optional(),
  password: z.string().min(12).max(128).optional(),
  status: recordStatusSchema.optional(),
});
const discordWebhookSchema = z.object({
  enabled: z.boolean(),
  webhookUrl: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        ["discord.com", "discordapp.com"].includes(url.hostname) &&
        /^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(url.pathname)
      );
    }, "Enter a valid Discord incoming webhook URL.")
    .optional(),
  categories: z.array(z.enum(discordAuditCategories)).min(1),
});
const discordWebhookTestSchema = z.object({
  webhookUrl: discordWebhookSchema.shape.webhookUrl,
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
  await writeAudit({
    actorUserId,
    action,
    entityType,
    entityId,
    afterData,
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

  app.get("/api/v1/admin/gangs", async (request) => {
    requirePermission(request, "gang.read");
    const gangs = await prisma.gang.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { memberships: { where: { active: true } } } },
      },
      take: 250,
    });
    return envelope(request, gangs);
  });

  app.get("/api/v1/admin/players", async (request) => {
    requirePermission(request, "user.manage");
    const players = await prisma.player.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        memberships: {
          where: { active: true },
          take: 1,
          include: { gang: { select: { id: true, name: true, tag: true } } },
        },
      },
      take: 500,
    });
    return envelope(request, players);
  });

  app.get("/api/v1/admin/tournaments", async (request) => {
    requirePermission(request, "tournament.read");
    const tournaments = await prisma.tournament.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { participants: true, matches: true } } },
      take: 250,
    });
    return envelope(request, tournaments);
  });

  app.get("/api/v1/admin/matches", async (request) => {
    requirePermission(request, "match.update");
    const matches = await prisma.match.findMany({
      orderBy: [{ scheduledAt: "desc" }, { updatedAt: "desc" }],
      include: {
        gangA: { select: { id: true, name: true, tag: true } },
        gangB: { select: { id: true, name: true, tag: true } },
        tournament: { select: { id: true, name: true, slug: true } },
      },
      take: 500,
    });
    return envelope(request, matches);
  });

  app.get("/api/v1/admin/events", async (request) => {
    requirePermission(request, "event.manage");
    const events = await prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      take: 250,
    });
    return envelope(request, events);
  });

  app.get("/api/v1/admin/live-streams", async (request) => {
    requirePermission(request, "stream.manage");
    const streams = await prisma.liveStream.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        tournament: { select: { id: true, slug: true, name: true } },
      },
      take: 250,
    });
    return envelope(request, streams);
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

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/players/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "user.manage");
      const player = await prisma.player.update({
        where: { id: request.params.id },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      await recordAudit(
        auth.userId,
        "player.archive",
        "Player",
        player.id,
        player,
      );
      return reply.code(204).send();
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

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "tournament.update");
      const tournament = await prisma.tournament.update({
        where: { id: request.params.id },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      await recordAudit(
        auth.userId,
        "tournament.archive",
        "Tournament",
        tournament.id,
        tournament,
      );
      return reply.code(204).send();
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
          return { ...updated, slotCount, roundCount };
        },
        { isolationLevel: "Serializable" },
      );
      await recordAudit(
        auth.userId,
        "tournament.bracket.generate",
        "Tournament",
        result.id,
        result,
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

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/matches/:id",
    async (request) => {
      const auth = requirePermission(request, "match.update");
      const input = matchUpdateSchema.parse(request.body);
      if (input.gangAId && input.gangBId && input.gangAId === input.gangBId)
        throw new HttpError(
          422,
          "MATCH_GANGS_INVALID",
          "A gang cannot compete against itself.",
        );
      const before = await prisma.match.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      const match = await prisma.match.update({
        where: { id: request.params.id },
        data: compact(input),
      });
      await writeAudit({
        actorUserId: auth.userId,
        action: "match.update",
        entityType: "Match",
        entityId: match.id,
        beforeData: before,
        afterData: match,
      });
      return envelope(request, match);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/matches/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "match.update");
      const match = await prisma.match.delete({
        where: { id: request.params.id },
      });
      await writeAudit({
        actorUserId: auth.userId,
        action: "match.delete",
        entityType: "Match",
        entityId: match.id,
        beforeData: match,
      });
      return reply.code(204).send();
    },
  );

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
          return { before: match, updated };
        },
        { isolationLevel: "Serializable" },
      );
      await writeAudit({
        actorUserId: auth.userId,
        action: "match.finalize",
        entityType: "Match",
        entityId: result.updated.id,
        beforeData: result.before,
        afterData: result.updated,
      });
      return envelope(request, result.updated);
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
          return { before: match, updated };
        },
        { isolationLevel: "Serializable" },
      );
      await writeAudit({
        actorUserId: auth.userId,
        action: "match.advance",
        entityType: "Match",
        entityId: result.updated.id,
        beforeData: result.before,
        afterData: result.updated,
      });
      return envelope(request, result.updated);
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

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/live-streams/:id/refresh",
    async (request) => {
      const auth = requirePermission(request, "stream.manage");
      const stream = await refreshStreamStatus(request.params.id);
      await recordAudit(
        auth.userId,
        "stream.status.refresh",
        "LiveStream",
        stream.id,
        {
          status: stream.status,
          lastCheckedAt: stream.lastCheckedAt,
          lastStatusError: stream.lastStatusError,
        },
      );
      return envelope(request, stream);
    },
  );

  app.post("/api/v1/admin/live-streams/refresh", async (request) => {
    const auth = requirePermission(request, "stream.manage");
    const ids = await prisma.liveStream.findMany({
      where: { autoDetect: true, status: { not: "ARCHIVED" } },
      select: { id: true },
      take: 100,
    });
    const streams = await Promise.all(
      ids.map((stream) => refreshStreamStatus(stream.id)),
    );
    await recordAudit(
      auth.userId,
      "stream.status.refresh-all",
      "LiveStream",
      "all",
      { checked: streams.length },
    );
    return envelope(request, streams);
  });

  app.get("/api/v1/admin/administrators", async (request) => {
    requirePermission(request, "user.manage");
    const administrators = await prisma.user.findMany({
      where: { roles: { some: { role: { name: "Super Administrator" } } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { select: { role: { select: { name: true } } } },
      },
    });
    return envelope(request, administrators);
  });

  app.post("/api/v1/admin/administrators", async (request, reply) => {
    const auth = requirePermission(request, "user.manage");
    const input = administratorCreateSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const role = await prisma.role.findUnique({
      where: { name: "Super Administrator" },
    });
    if (!role)
      throw new HttpError(
        409,
        "ADMIN_ROLE_MISSING",
        "Run the database seed before creating administrators.",
      );
    const administrator = await prisma.user.create({
      data: {
        email: input.email,
        username: input.email.split("@")[0] ?? "administrator",
        displayName: input.displayName,
        passwordHash,
        status: "ACTIVE",
        roles: { create: { roleId: role.id } },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    await recordAudit(
      auth.userId,
      "admin.create",
      "User",
      administrator.id,
      administrator,
    );
    return reply.code(201).send(envelope(request, administrator));
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/administrators/:id",
    async (request) => {
      const auth = requirePermission(request, "user.manage");
      const input = administratorUpdateSchema.parse(request.body);
      if (
        request.params.id === auth.userId &&
        input.status &&
        input.status !== "ACTIVE"
      )
        throw new HttpError(
          409,
          "ADMIN_SELF_DISABLE",
          "You cannot disable your own administrator account.",
        );
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: request.params.id },
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          lastLoginAt: true,
        },
      });
      const administrator = await prisma.user.update({
        where: { id: request.params.id },
        data: compact({
          email: input.email,
          displayName: input.displayName,
          status: input.status,
          passwordHash: input.password
            ? await hashPassword(input.password)
            : undefined,
        }),
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });
      if (input.password || (input.status && input.status !== "ACTIVE"))
        await prisma.refreshToken.deleteMany({
          where: { userId: administrator.id },
        });
      await writeAudit({
        actorUserId: auth.userId,
        action: "admin.update",
        entityType: "User",
        entityId: administrator.id,
        beforeData: before,
        afterData: administrator,
      });
      return envelope(request, administrator);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/administrators/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "user.manage");
      if (request.params.id === auth.userId)
        throw new HttpError(
          409,
          "ADMIN_SELF_DELETE",
          "You cannot remove your own administrator account.",
        );
      const activeCount = await prisma.user.count({
        where: {
          status: "ACTIVE",
          roles: { some: { role: { name: "Super Administrator" } } },
        },
      });
      if (activeCount <= 1)
        throw new HttpError(
          409,
          "LAST_ADMIN_REQUIRED",
          "At least one active administrator must remain.",
        );
      const administrator = await prisma.user.update({
        where: { id: request.params.id },
        data: {
          status: "ARCHIVED",
          sessions: { deleteMany: {} },
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
        },
      });
      await recordAudit(
        auth.userId,
        "admin.remove",
        "User",
        administrator.id,
        administrator,
      );
      return reply.code(204).send();
    },
  );

  app.get("/api/v1/admin/discord-audit", async (request) => {
    requirePermission(request, "settings.manage");
    const config = await getDiscordAuditConfig();
    return envelope(request, {
      enabled: config.enabled,
      configured: Boolean(config.webhookUrl),
      maskedWebhookUrl: maskWebhookUrl(config.webhookUrl),
      categories: config.categories,
    });
  });

  app.put("/api/v1/admin/discord-audit", async (request) => {
    const auth = requirePermission(request, "settings.manage");
    const input = discordWebhookSchema.parse(request.body);
    const current = await getDiscordAuditConfig();
    const webhookUrl = input.webhookUrl ?? current.webhookUrl;
    if (input.enabled && !webhookUrl)
      throw new HttpError(
        422,
        "DISCORD_WEBHOOK_REQUIRED",
        "Add a Discord webhook URL before enabling logs.",
      );
    const value = {
      enabled: input.enabled,
      webhookUrl,
      categories: input.categories,
    };
    const setting = await prisma.platformSetting.upsert({
      where: { key: discordAuditSettingKey },
      update: { value, updatedByUserId: auth.userId },
      create: {
        key: discordAuditSettingKey,
        value,
        updatedByUserId: auth.userId,
      },
    });
    await recordAudit(
      auth.userId,
      "setting.discord-audit.update",
      "PlatformSetting",
      setting.id,
      {
        enabled: value.enabled,
        configured: Boolean(value.webhookUrl),
        categories: value.categories,
      },
    );
    return envelope(request, {
      enabled: value.enabled,
      configured: Boolean(value.webhookUrl),
      maskedWebhookUrl: maskWebhookUrl(value.webhookUrl),
      categories: value.categories,
    });
  });

  app.post("/api/v1/admin/discord-audit/test", async (request) => {
    const auth = requirePermission(request, "settings.manage");
    const input = discordWebhookTestSchema.parse(request.body ?? {});
    const current = await getDiscordAuditConfig();
    const webhookUrl = input.webhookUrl ?? current.webhookUrl;
    if (!webhookUrl)
      throw new HttpError(
        422,
        "DISCORD_WEBHOOK_REQUIRED",
        "Add a Discord webhook URL before testing.",
      );
    await executeDiscordWebhook(webhookUrl, {
      username: "World Star Audit",
      embeds: [
        {
          title: "AUDIT WEBHOOK CONNECTED",
          description: "World Star administrator activity will be logged here.",
          color: 13_147_218,
          fields: [
            { name: "Administrator", value: auth.userId, inline: true },
            { name: "Status", value: "Connected", inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
    return envelope(request, { delivered: true });
  });

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
