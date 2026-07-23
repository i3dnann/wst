import type { FastifyInstance } from "fastify";
import { matchResultSchema } from "@mafia/shared";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  assertValidWinner,
  generateOpeningRound,
  openingRoundSeedOrder,
} from "../domain/bracket.js";
import { canManageTournamentParticipants } from "../domain/tournament.js";
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
import { realtimeHub } from "../lib/realtime.js";
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
  history: z.string().trim().max(20_000).optional(),
  logoUrl: httpsUrlSchema.optional(),
  bannerUrl: httpsUrlSchema.optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  foundedAt: z.coerce.date().optional(),
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
  avatarUrl: httpsUrlSchema.optional(),
  externalFivemId: z.string().trim().min(2).max(128).optional(),
  status: recordStatusSchema.default("ACTIVE"),
});
const tournamentInputSchema = z
  .object({
    name: z.string().trim().min(2).max(140),
    slug: slugSchema,
    description: z.string().trim().max(4000).optional(),
    bannerUrl: httpsUrlSchema.optional(),
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
    registrationOpenAt: z.coerce.date().optional(),
    registrationCloseAt: z.coerce.date().optional(),
    seasonId: z.string().min(20).max(40).nullable().optional(),
    maximumParticipants: z.number().int().min(2).max(256),
    rules: z.string().trim().max(20_000).optional(),
    prizeDescription: z.string().trim().max(1000).optional(),
    featured: z.boolean().default(false),
    publicVisible: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.endAt && value.endAt <= value.startAt) {
      context.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "End time must be after the start time.",
      });
    }
    if (
      value.registrationOpenAt &&
      value.registrationCloseAt &&
      value.registrationCloseAt <= value.registrationOpenAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["registrationCloseAt"],
        message: "Registration close time must be after registration opens.",
      });
    }
    if (
      value.registrationCloseAt &&
      value.registrationCloseAt > value.startAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["registrationCloseAt"],
        message: "Registration must close before the tournament starts.",
      });
    }
  });
const matchInputSchema = z.object({
  tournamentId: z.string().min(20).max(40).optional(),
  gangAId: z.string().min(20).max(40).optional(),
  gangBId: z.string().min(20).max(40).optional(),
  bestOf: z
    .number()
    .int()
    .min(1)
    .max(15)
    .refine((value) => value % 2 === 1, "Best-of must be an odd number.")
    .default(1),
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
const participantUpdateSchema = z
  .object({
    seed: z.number().int().min(1).max(256).optional(),
    status: z
      .enum([
        "PENDING",
        "APPROVED",
        "REJECTED",
        "WITHDRAWN",
        "ELIMINATED",
        "CHAMPION",
      ])
      .optional(),
  })
  .refine((input) => input.seed !== undefined || input.status !== undefined, {
    message: "Provide a seed or participant status.",
  });
const eventInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    slug: slugSchema,
    description: z.string().trim().max(5000).optional(),
    imageUrl: httpsUrlSchema.optional(),
    location: z.string().trim().max(160).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    status: z
      .enum([
        "DRAFT",
        "SCHEDULED",
        "LIVE",
        "COMPLETED",
        "CANCELLED",
        "ARCHIVED",
      ])
      .default("DRAFT"),
    featured: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.endsAt && value.endsAt <= value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Event end time must be after its start time.",
      });
    }
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
  bestOf: z
    .number()
    .int()
    .min(1)
    .max(15)
    .refine((value) => value % 2 === 1, "Best-of must be an odd number.")
    .optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  bracketRoundId: z.string().min(20).max(40).nullable().optional(),
  position: z.number().int().min(1).nullable().optional(),
  streamId: z.string().min(20).max(40).nullable().optional(),
  resultNotes: z.string().trim().max(4_000).nullable().optional(),
  disputeReason: z.string().trim().max(4_000).nullable().optional(),
  disputeNotes: z.string().trim().max(20_000).nullable().optional(),
  disputeAssignedUserId: z.string().min(20).max(40).nullable().optional(),
  status: z
    .enum([
      "SCHEDULED",
      "CHECK_IN_OPEN",
      "READY",
      "LIVE",
      "AWAITING_RESULT",
      "DISPUTED",
      "COMPLETED",
      "CANCELLED",
      "FORFEIT",
    ])
    .optional(),
});
const bracketGenerateSchema = z
  .object({
    confirmReset: z.boolean().default(false),
    confirmationName: z.string().trim().max(140).optional(),
    placement: z.enum(["SEEDED", "RANDOM", "DRAW"]).default("SEEDED"),
    drawParticipantIds: z
      .array(z.string().min(20).max(40))
      .min(2)
      .max(256)
      .optional(),
  })
  .superRefine((input, context) => {
    if (input.placement === "DRAW" && !input.drawParticipantIds) {
      context.addIssue({
        code: "custom",
        path: ["drawParticipantIds"],
        message: "A completed draw order is required.",
      });
    }
  });
const matchReopenSchema = z.object({
  version: z.number().int().min(0),
  reason: z.string().trim().min(5).max(4_000),
});
const disputeSchema = z.object({
  reason: z.string().trim().min(5).max(4_000),
  notes: z.string().trim().max(20_000).optional(),
  assignedUserId: z.string().min(20).max(40).nullable().optional(),
});
const administratorCreateSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
  roleIds: z.array(z.string().min(20).max(40)).min(1).max(20),
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

const tournamentTransitions: Record<string, readonly string[]> = {
  DRAFT: ["REGISTRATION_OPEN", "CANCELLED", "ARCHIVED"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "CANCELLED", "ARCHIVED"],
  REGISTRATION_CLOSED: [
    "IN_PROGRESS",
    "REGISTRATION_OPEN",
    "CANCELLED",
    "ARCHIVED",
  ],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED", "DRAFT"],
  ARCHIVED: ["DRAFT", "CANCELLED", "COMPLETED"],
};

function bracketRoundName(roundNumber: number, totalRounds: number): string {
  const remaining = totalRounds - roundNumber + 1;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinals";
  if (remaining === 3) return "Quarterfinals";
  return `Round of ${String(2 ** remaining)}`;
}

function assertWinnerHasHigherScore(
  gangAId: string | null,
  winnerGangId: string,
  gangAScore: number,
  gangBScore: number,
  bestOf = 1,
): void {
  const winnerScore = winnerGangId === gangAId ? gangAScore : gangBScore;
  const loserScore = winnerGangId === gangAId ? gangBScore : gangAScore;
  if (winnerScore <= loserScore)
    throw new HttpError(
      422,
      "WINNER_SCORE_INVALID",
      "The selected winner must have the higher score.",
    );
  if (bestOf > 1) {
    const requiredWins = Math.floor(bestOf / 2) + 1;
    if (winnerScore !== requiredWins || loserScore >= requiredWins)
      throw new HttpError(
        422,
        "BEST_OF_SCORE_INVALID",
        `A best-of-${String(bestOf)} result requires exactly ${String(requiredWins)} wins for the winner.`,
      );
  }
}

type ProgressionMatch = {
  id: string;
  tournamentId: string | null;
  nextMatchId: string | null;
  winnerGangId: string | null;
};

async function clearDownstreamWinner(
  tx: Prisma.TransactionClient,
  source: ProgressionMatch,
): Promise<void> {
  if (!source.nextMatchId || !source.winnerGangId) return;
  const next = await tx.match.findUnique({ where: { id: source.nextMatchId } });
  if (!next) return;
  if (next.winnerGangId) await clearDownstreamWinner(tx, next);

  const slotData =
    next.gangAId === source.winnerGangId
      ? { gangAId: null }
      : next.gangBId === source.winnerGangId
        ? { gangBId: null }
        : {};
  await tx.match.update({
    where: { id: next.id },
    data: {
      ...slotData,
      gangAScore: null,
      gangBScore: null,
      winnerGangId: null,
      status: "SCHEDULED",
      finalizedAt: null,
      finalizedByUserId: null,
      reopenedAt: new Date(),
      reopenReason: "Upstream bracket result was changed.",
      resultNotes: null,
      version: { increment: 1 },
    },
  });
  if (next.tournamentId) {
    const restoredGangIds = [next.gangAId, next.gangBId].filter(
      (gangId): gangId is string => Boolean(gangId),
    );
    if (restoredGangIds.length) {
      await tx.tournamentParticipant.updateMany({
        where: {
          tournamentId: next.tournamentId,
          gangId: { in: restoredGangIds },
          status: { in: ["ELIMINATED", "CHAMPION"] },
        },
        data: { status: "APPROVED" },
      });
    }
  }
}

function assertTournamentTransition(current: string, next: string): void {
  if (current === next) return;
  if (!(tournamentTransitions[current] ?? []).includes(next)) {
    throw new HttpError(
      422,
      "TOURNAMENT_TRANSITION_INVALID",
      `Tournament status cannot change from ${current.replaceAll("_", " ")} to ${next.replaceAll("_", " ")}.`,
    );
  }
}

async function assertTournamentCanStart(
  tx: Prisma.TransactionClient | typeof prisma,
  tournamentId: string,
): Promise<void> {
  const approved = await tx.tournamentParticipant.count({
    where: { tournamentId, status: "APPROVED" },
  });
  if (approved < 2) {
    throw new HttpError(
      409,
      "TOURNAMENT_PARTICIPANTS_REQUIRED",
      "At least two approved participants are required to start a tournament.",
    );
  }
  const rounds = await tx.bracketRound.count({ where: { tournamentId } });
  if (rounds === 0) {
    throw new HttpError(
      409,
      "TOURNAMENT_BRACKET_REQUIRED",
      "Generate the tournament bracket before starting the tournament.",
    );
  }
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
      archivedGangs,
      totalPlayers,
      activePlayers,
      totalTournaments,
      draftTournaments,
      registrationOpenTournaments,
      activeTournaments,
      completedTournaments,
      upcomingMatches,
      liveMatches,
      awaitingResults,
      disputedMatches,
      upcomingEvents,
      liveStreams,
      pendingMedia,
      administrators,
      activity,
      nextMatches,
      unseededParticipants,
      streamsWithErrors,
    ] = await Promise.all([
      prisma.gang.count(),
      prisma.gang.count({ where: { status: "ACTIVE" } }),
      prisma.gang.count({ where: { status: "ARCHIVED" } }),
      prisma.player.count(),
      prisma.player.count({ where: { status: "ACTIVE" } }),
      prisma.tournament.count(),
      prisma.tournament.count({ where: { status: "DRAFT" } }),
      prisma.tournament.count({ where: { status: "REGISTRATION_OPEN" } }),
      prisma.tournament.count({ where: { status: "IN_PROGRESS" } }),
      prisma.tournament.count({ where: { status: "COMPLETED" } }),
      prisma.match.count({
        where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      }),
      prisma.match.count({ where: { status: "LIVE" } }),
      prisma.match.count({ where: { status: "AWAITING_RESULT" } }),
      prisma.match.count({ where: { status: "DISPUTED" } }),
      prisma.event.count({
        where: { startsAt: { gte: new Date() }, status: "SCHEDULED" },
      }),
      prisma.liveStream.count({ where: { status: "LIVE" } }),
      prisma.mediaAsset.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { email: { not: null }, status: "ACTIVE" } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { actor: { select: { displayName: true } } },
      }),
      prisma.match.findMany({
        where: {
          scheduledAt: { gte: new Date() },
          status: { in: ["SCHEDULED", "CHECK_IN_OPEN", "READY"] },
        },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        include: {
          gangA: { select: { name: true, tag: true } },
          gangB: { select: { name: true, tag: true } },
          tournament: { select: { name: true, slug: true } },
        },
      }),
      prisma.tournamentParticipant.count({
        where: { status: "APPROVED", seed: null },
      }),
      prisma.liveStream.findMany({
        where: { lastStatusError: { not: null }, status: { not: "ARCHIVED" } },
        orderBy: { lastCheckedAt: "desc" },
        take: 5,
        select: {
          id: true,
          streamerName: true,
          platform: true,
          lastCheckedAt: true,
          lastStatusError: true,
        },
      }),
    ]);
    return envelope(request, {
      summary: {
        totalGangs,
        activeGangs,
        archivedGangs,
        totalPlayers,
        activePlayers,
        totalTournaments,
        draftTournaments,
        registrationOpenTournaments,
        activeTournaments,
        completedTournaments,
        upcomingMatches,
        liveMatches,
        awaitingResults,
        disputedMatches,
        upcomingEvents,
        liveStreams,
        pendingMedia,
        administrators,
      },
      activity,
      attention: { nextMatches, unseededParticipants, streamsWithErrors },
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
    requirePermission(request, "player.read");
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

  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id",
    async (request) => {
      requirePermission(request, "tournament.read");
      const tournament = await prisma.tournament.findUnique({
        where: { id: request.params.id },
        include: {
          season: { select: { id: true, name: true } },
          participants: {
            orderBy: [{ seed: "asc" }, { registeredAt: "asc" }],
            include: {
              gang: true,
              roster: {
                include: {
                  player: {
                    select: { id: true, slug: true, displayName: true },
                  },
                },
              },
            },
          },
          rounds: {
            orderBy: { sortOrder: "asc" },
            include: {
              matches: {
                orderBy: { position: "asc" },
                include: {
                  gangA: {
                    select: { id: true, name: true, tag: true, logoUrl: true },
                  },
                  gangB: {
                    select: { id: true, name: true, tag: true, logoUrl: true },
                  },
                  winnerGang: {
                    select: { id: true, name: true, tag: true, logoUrl: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!tournament)
        throw new HttpError(
          404,
          "TOURNAMENT_NOT_FOUND",
          "Tournament was not found.",
        );
      return envelope(request, tournament);
    },
  );

  app.get("/api/v1/admin/matches", async (request) => {
    requirePermission(request, "match.update");
    const matches = await prisma.match.findMany({
      orderBy: [{ scheduledAt: "desc" }, { updatedAt: "desc" }],
      include: {
        gangA: { select: { id: true, name: true, tag: true } },
        gangB: { select: { id: true, name: true, tag: true } },
        winnerGang: { select: { id: true, name: true, tag: true } },
        tournament: { select: { id: true, name: true, slug: true } },
        bracketRound: { select: { id: true, name: true, roundNumber: true } },
        nextMatch: { select: { id: true, position: true } },
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
      const auth = requirePermission(request, "gang.archive");
      const gang = await prisma.gang.update({
        where: { id: request.params.id },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      await recordAudit(auth.userId, "gang.archive", "Gang", gang.id, gang);
      return reply.code(204).send();
    },
  );

  app.post("/api/v1/admin/players", async (request, reply) => {
    const auth = requirePermission(request, "player.create");
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
      const auth = requirePermission(request, "player.update");
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
      const auth = requirePermission(request, "player.archive");
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
      const before = await prisma.tournament.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      if (input.status) {
        assertTournamentTransition(before.status, input.status);
        if (input.status === "IN_PROGRESS") {
          await assertTournamentCanStart(prisma, before.id);
        }
      }
      const startAt = input.startAt ?? before.startAt;
      const endAt = input.endAt ?? before.endAt;
      const registrationOpenAt =
        input.registrationOpenAt ?? before.registrationOpenAt;
      const registrationCloseAt =
        input.registrationCloseAt ?? before.registrationCloseAt;
      if (endAt && endAt <= startAt)
        throw new HttpError(
          422,
          "TOURNAMENT_DATES_INVALID",
          "Tournament end time must be after its start time.",
        );
      if (
        registrationOpenAt &&
        registrationCloseAt &&
        registrationCloseAt <= registrationOpenAt
      )
        throw new HttpError(
          422,
          "REGISTRATION_DATES_INVALID",
          "Registration close time must be after registration opens.",
        );
      if (registrationCloseAt && registrationCloseAt > startAt)
        throw new HttpError(
          422,
          "REGISTRATION_AFTER_START",
          "Registration must close before the tournament starts.",
        );
      const tournament = await prisma.tournament.update({
        where: { id: request.params.id },
        data: compact({
          ...input,
          archivedAt:
            input.status === "ARCHIVED"
              ? new Date()
              : input.status && before.status === "ARCHIVED"
                ? null
                : undefined,
        }),
      });
      await writeAudit({
        actorUserId: auth.userId,
        action: "tournament.update",
        entityType: "Tournament",
        entityId: tournament.id,
        beforeData: before,
        afterData: tournament,
      });
      return envelope(request, tournament);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "tournament.archive");
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
        select: { maximumParticipants: true, status: true },
      });
      if (!tournament)
        throw new HttpError(
          404,
          "TOURNAMENT_NOT_FOUND",
          "Tournament was not found.",
        );
      if (!canManageTournamentParticipants(tournament.status))
        throw new HttpError(
          409,
          "TOURNAMENT_ARCHIVED",
          "Restore the tournament before adding participants.",
        );
      const gang = await prisma.gang.findUnique({
        where: { id: input.gangId },
        select: { status: true },
      });
      if (!gang || gang.status !== "ACTIVE")
        throw new HttpError(
          409,
          "GANG_NOT_ACTIVE",
          "Only an active gang can be added to a tournament.",
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
      const input = participantUpdateSchema.parse(request.body);
      const tournament = await prisma.tournament.findUniqueOrThrow({
        where: { id: request.params.id },
        select: { maximumParticipants: true, status: true },
      });
      if (!canManageTournamentParticipants(tournament.status))
        throw new HttpError(
          409,
          "TOURNAMENT_ARCHIVED",
          "Restore the tournament before editing participants.",
        );
      if (input.seed && input.seed > tournament.maximumParticipants)
        throw new HttpError(
          422,
          "SEED_EXCEEDS_CAPACITY",
          "Seed cannot exceed tournament capacity.",
        );
      const participant = await prisma.tournamentParticipant.update({
        where: {
          id: request.params.participantId,
          tournamentId: request.params.id,
        },
        data: compact({
          seed: input.seed,
          status: input.status,
          approvedAt: input.status === "APPROVED" ? new Date() : undefined,
        }),
        include: { gang: true },
      });
      await recordAudit(
        auth.userId,
        "tournament.participant.update",
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
      const participant = await prisma.$transaction(async (tx) => {
        const existing = await tx.tournamentParticipant.findFirst({
          where: {
            id: request.params.participantId,
            tournamentId: request.params.id,
          },
          include: { gang: true },
        });
        if (!existing)
          throw new HttpError(
            404,
            "PARTICIPANT_NOT_FOUND",
            "The tournament gang was not found.",
          );

        const affectedMatches = await tx.match.findMany({
          where: {
            tournamentId: request.params.id,
            OR: [
              { gangAId: existing.gangId },
              { gangBId: existing.gangId },
              { winnerGangId: existing.gangId },
            ],
          },
        });
        for (const match of affectedMatches) {
          if (match.winnerGangId) await clearDownstreamWinner(tx, match);
        }

        const resetResult = {
          gangAScore: null,
          gangBScore: null,
          winnerGangId: null,
          status: "SCHEDULED" as const,
          finalizedAt: null,
          finalizedByUserId: null,
          version: { increment: 1 },
        };
        await tx.match.updateMany({
          where: { tournamentId: request.params.id, gangAId: existing.gangId },
          data: { ...resetResult, gangAId: null },
        });
        await tx.match.updateMany({
          where: { tournamentId: request.params.id, gangBId: existing.gangId },
          data: { ...resetResult, gangBId: null },
        });
        await tx.match.updateMany({
          where: {
            tournamentId: request.params.id,
            winnerGangId: existing.gangId,
          },
          data: resetResult,
        });
        await tx.tournamentParticipant.delete({ where: { id: existing.id } });
        await tx.tournament.update({
          where: { id: request.params.id },
          data: { bracketVersion: { increment: 1 } },
        });
        return existing;
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
    "/api/v1/admin/tournaments/:id/draw/start",
    async (request) => {
      const auth = requirePermission(request, "tournament.bracket.manage");
      const tournament = await prisma.tournament.findUnique({
        where: { id: request.params.id },
        include: {
          participants: {
            where: { status: "APPROVED" },
            orderBy: [{ seed: "asc" }, { registeredAt: "asc" }],
            include: {
              gang: {
                select: {
                  id: true,
                  name: true,
                  tag: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
      });
      if (!tournament)
        throw new HttpError(
          404,
          "TOURNAMENT_NOT_FOUND",
          "Tournament was not found.",
        );
      if (tournament.status === "ARCHIVED")
        throw new HttpError(
          409,
          "TOURNAMENT_ARCHIVED",
          "Restore the tournament before starting a live draw.",
        );
      if (tournament.format !== "SINGLE_ELIMINATION")
        throw new HttpError(
          422,
          "DRAW_FORMAT_INVALID",
          "The live draw is available only for single-elimination tournaments.",
        );
      const entrantCount = tournament.participants.length;
      const validEntrantCount =
        entrantCount >= 2 &&
        entrantCount <= 32 &&
        (entrantCount & (entrantCount - 1)) === 0;
      if (!validEntrantCount)
        throw new HttpError(
          422,
          "DRAW_ENTRANTS_INVALID",
          "Approve exactly 2, 4, 8, 16, or 32 gangs before starting the live draw.",
        );
      const draw = realtimeHub.startDraw({
        tournamentId: tournament.id,
        tournamentSlug: tournament.slug,
        tournamentName: tournament.name,
        participants: tournament.participants.map((participant) => ({
          id: participant.id,
          gang: participant.gang,
        })),
      });
      await writeAudit({
        actorUserId: auth.userId,
        action: "tournament.draw.start",
        entityType: "Tournament",
        entityId: tournament.id,
        afterData: {
          participantCount: draw.participants.length,
          tournamentSlug: draw.tournamentSlug,
        },
      });
      return envelope(request, draw);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id/draw/spin",
    async (request) => {
      requirePermission(request, "tournament.bracket.manage");
      const draw = realtimeHub.getDraw(request.params.id);
      if (!draw)
        throw new HttpError(
          409,
          "DRAW_NOT_ACTIVE",
          "Start the live tournament draw before spinning.",
        );
      const approvedParticipants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId: request.params.id, status: "APPROVED" },
        select: { id: true },
      });
      const approvedIds = new Set(
        approvedParticipants.map((participant) => participant.id),
      );
      if (
        approvedIds.size !== draw.participants.length ||
        draw.participants.some(
          (participant) => !approvedIds.has(participant.id),
        )
      )
        throw new HttpError(
          409,
          "DRAW_PARTICIPANTS_CHANGED",
          "The approved gangs changed. Reset and restart the live draw.",
        );
      if (draw.drawnParticipantIds.length >= draw.participants.length)
        throw new HttpError(
          409,
          "DRAW_COMPLETE",
          "Every gang has already been drawn.",
        );
      const result = realtimeHub.spinDraw(request.params.id);
      if (!result)
        throw new HttpError(
          409,
          "DRAW_SPIN_FAILED",
          "The live draw could not select another gang.",
        );
      return envelope(request, result);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id/draw/reset",
    (request) => {
      requirePermission(request, "tournament.bracket.manage");
      const draw = realtimeHub.resetDraw(request.params.id);
      if (!draw)
        throw new HttpError(
          409,
          "DRAW_NOT_ACTIVE",
          "Start the live tournament draw before resetting it.",
        );
      return envelope(request, draw);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id/draw",
    (request, reply) => {
      requirePermission(request, "tournament.bracket.manage");
      realtimeHub.cancelDraw(request.params.id);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/tournaments/:id/bracket/generate",
    async (request) => {
      const auth = requirePermission(request, "tournament.bracket.manage");
      const input = bracketGenerateSchema.parse(request.body ?? {});
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
          if (tournament.status === "ARCHIVED")
            throw new HttpError(
              409,
              "TOURNAMENT_ARCHIVED",
              "Restore the tournament before generating a bracket.",
            );
          if (tournament.format !== "SINGLE_ELIMINATION")
            throw new HttpError(
              422,
              "BRACKET_FORMAT_MANUAL",
              "Automatic generation is currently available only for single-elimination tournaments. Manage this format manually.",
            );
          if (tournament.participants.length < 2)
            throw new HttpError(
              409,
              "BRACKET_TOO_SMALL",
              "Add at least two approved gangs before generating the bracket.",
            );
          if (tournament.participants.length > tournament.maximumParticipants)
            throw new HttpError(
              409,
              "TOURNAMENT_OVER_CAPACITY",
              "Approved participants exceed tournament capacity.",
            );
          const existingRounds = await tx.bracketRound.count({
            where: { tournamentId: tournament.id },
          });
          const completedMatches = await tx.match.count({
            where: {
              tournamentId: tournament.id,
              bracketRoundId: { not: null },
              status: "COMPLETED",
            },
          });
          if (existingRounds > 0 && !input.confirmReset)
            throw new HttpError(
              409,
              "BRACKET_RESET_CONFIRMATION_REQUIRED",
              "Regenerating this bracket resets every match and result. Confirm the destructive reset first.",
              { completedMatches },
            );
          if (
            completedMatches > 0 &&
            input.confirmationName !== tournament.name
          )
            throw new HttpError(
              409,
              "BRACKET_NAME_CONFIRMATION_REQUIRED",
              "Type the tournament name exactly to reset a bracket containing completed results.",
              { tournamentName: tournament.name, completedMatches },
            );

          const participantById = new Map(
            tournament.participants.map((participant) => [
              participant.id,
              participant,
            ]),
          );
          const drawParticipantIds = input.drawParticipantIds ?? [];
          if (input.placement === "DRAW") {
            const uniqueDrawIds = new Set(drawParticipantIds);
            const isPowerOfTwo =
              tournament.participants.length > 1 &&
              (tournament.participants.length &
                (tournament.participants.length - 1)) ===
                0;
            if (
              !isPowerOfTwo ||
              drawParticipantIds.length !== tournament.participants.length ||
              uniqueDrawIds.size !== tournament.participants.length ||
              drawParticipantIds.some((id) => !participantById.has(id))
            )
              throw new HttpError(
                422,
                "DRAW_PARTICIPANTS_INVALID",
                "The draw must contain every approved gang exactly once, and the entrant count must be a power of two.",
              );
          }
          const participantOrder =
            input.placement === "DRAW"
              ? drawParticipantIds.flatMap((participantId) => {
                  const participant = participantById.get(participantId);
                  return participant ? [participant] : [];
                })
              : input.placement === "RANDOM"
                ? tournament.participants
                    .map((participant) => ({
                      participant,
                      random:
                        crypto.getRandomValues(new Uint32Array(1))[0] ?? 0,
                    }))
                    .sort((left, right) => left.random - right.random)
                    .map(({ participant }) => participant)
                : tournament.participants;
          const drawnSeedOrder =
            input.placement === "DRAW"
              ? openingRoundSeedOrder(tournament.participants.length)
              : [];
          const seeded = participantOrder.map((participant, index) => ({
            participant,
            seed:
              input.placement === "DRAW"
                ? (drawnSeedOrder[index] ?? null)
                : input.placement === "RANDOM"
                  ? index + 1
                  : participant.seed,
          }));
          if (seeded.some((entry) => entry.seed === null))
            throw new HttpError(
              422,
              "MISSING_SEEDS",
              "Every approved participant needs a seed before bracket generation.",
            );
          if (input.placement === "RANDOM" || input.placement === "DRAW") {
            await tx.tournamentParticipant.updateMany({
              where: { tournamentId: tournament.id, status: "APPROVED" },
              data: { seed: null },
            });
            for (const entry of seeded) {
              await tx.tournamentParticipant.update({
                where: { id: entry.participant.id },
                data: { seed: entry.seed },
              });
            }
          }
          const opening = generateOpeningRound(
            seeded.map(({ participant, seed }) => ({
              id: participant.id,
              seed: seed as number,
            })),
          );
          const slotCount = opening.length * 2;
          const roundCount = Math.log2(slotCount);
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
            select: { id: true, slug: true, bracketVersion: true },
          });
          return {
            ...updated,
            slotCount,
            roundCount,
            resetMatches: completedMatches,
          };
        },
        { isolationLevel: "Serializable" },
      );
      await writeAudit({
        actorUserId: auth.userId,
        action:
          result.resetMatches > 0
            ? "tournament.bracket.regenerate"
            : "tournament.bracket.generate",
        entityType: "Tournament",
        entityId: result.id,
        afterData: result,
        ...(result.resetMatches > 0
          ? {
              reason:
                "Administrator confirmed destructive bracket regeneration.",
            }
          : {}),
      });
      realtimeHub.completeDraw(result.id, result.slug, result.bracketVersion);
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
      if (input.status === "COMPLETED")
        throw new HttpError(
          422,
          "MATCH_FINALIZE_REQUIRED",
          "Use the result workflow to complete a match so scores, statistics, and winner progression remain consistent.",
        );
      if (input.status === "DISPUTED")
        throw new HttpError(
          422,
          "MATCH_DISPUTE_WORKFLOW_REQUIRED",
          "Open a dispute through Results & Disputes so its reason and assignment are recorded.",
        );
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
        data: {
          ...compact(input),
          version: { increment: 1 },
          ...(input.status === "LIVE"
            ? { startedAt: before.startedAt ?? new Date() }
            : {}),
        },
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
      const { before, match } = await prisma.$transaction(async (tx) => {
        const before = await tx.match.findUniqueOrThrow({
          where: { id: request.params.id },
        });
        if (before.winnerGangId) await clearDownstreamWinner(tx, before);
        const match = await tx.match.update({
          where: { id: before.id },
          data: {
            status: "CANCELLED",
            gangAScore: null,
            gangBScore: null,
            winnerGangId: null,
            finalizedAt: null,
            finalizedByUserId: null,
            version: { increment: 1 },
          },
        });
        if (before.tournamentId) {
          await tx.tournament.update({
            where: { id: before.tournamentId },
            data: { bracketVersion: { increment: 1 } },
          });
        }
        return { before, match };
      });
      await writeAudit({
        actorUserId: auth.userId,
        action: "match.cancel",
        entityType: "Match",
        entityId: match.id,
        beforeData: before,
        afterData: match,
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
          if (match.status === "DISPUTED")
            throw new HttpError(
              409,
              "MATCH_DISPUTED",
              "Resolve the dispute before finalizing this match.",
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
          assertWinnerHasHigherScore(
            match.gangAId,
            input.winnerGangId,
            input.gangAScore,
            input.gangBScore,
            match.bestOf,
          );

          const competingGangIds = [match.gangAId, match.gangBId].filter(
            (gangId): gangId is string => Boolean(gangId),
          );
          if (competingGangIds.length < 2)
            throw new HttpError(
              422,
              "MATCH_COMPETITORS_MISSING",
              "Both competitors are required before recording a result.",
            );
          if (
            input.playerStats.some(
              (stat) => !competingGangIds.includes(stat.gangId),
            )
          )
            throw new HttpError(
              422,
              "PLAYER_STAT_GANG_INVALID",
              "Every player statistic must belong to a competing gang.",
            );
          const playerIds = input.playerStats.map((stat) => stat.playerId);
          const eligiblePlayers = await tx.player.findMany({
            where: { id: { in: playerIds } },
            select: {
              id: true,
              memberships: {
                where: { active: true },
                select: { gangId: true },
              },
              rosters: {
                where: match.tournamentId
                  ? { participant: { tournamentId: match.tournamentId } }
                  : { id: "__independent_match_has_no_roster__" },
                select: { participant: { select: { gangId: true } } },
              },
            },
          });
          const eligibleById = new Map(
            eligiblePlayers.map((player) => [player.id, player]),
          );
          for (const stat of input.playerStats) {
            const player = eligibleById.get(stat.playerId);
            const eligible =
              player?.memberships.some(
                (membership) => membership.gangId === stat.gangId,
              ) ||
              player?.rosters.some(
                (roster) => roster.participant.gangId === stat.gangId,
              );
            if (!eligible)
              throw new HttpError(
                422,
                "PLAYER_NOT_ELIGIBLE",
                "A player is not on the selected gang's active membership or tournament roster.",
                { playerId: stat.playerId },
              );
          }

          await tx.matchPlayerStat.deleteMany({ where: { matchId: match.id } });
          await tx.matchPlayerStat.createMany({
            data: input.playerStats.map((stat) => ({
              ...stat,
              notes: stat.notes ?? null,
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
              ...(input.resultNotes !== undefined
                ? { resultNotes: input.resultNotes }
                : {}),
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
            const winnerEntersGangB = Boolean(
              match.position && match.position % 2 === 0,
            );
            const occupied = winnerEntersGangB ? next.gangBId : next.gangAId;
            if (occupied && occupied !== input.winnerGangId)
              throw new HttpError(
                409,
                "BRACKET_SLOT_OCCUPIED",
                "The winner's next bracket slot is occupied by a different gang.",
              );
            await tx.match.update({
              where: { id: next.id },
              data: winnerEntersGangB
                ? { gangBId: input.winnerGangId }
                : { gangAId: input.winnerGangId },
            });
          }
          if (match.tournamentId) {
            const loserGangId =
              input.winnerGangId === match.gangAId
                ? match.gangBId
                : match.gangAId;
            if (loserGangId) {
              await tx.tournamentParticipant.updateMany({
                where: {
                  tournamentId: match.tournamentId,
                  gangId: loserGangId,
                },
                data: { status: "ELIMINATED" },
              });
            }
            await tx.tournamentParticipant.updateMany({
              where: {
                tournamentId: match.tournamentId,
                gangId: input.winnerGangId,
              },
              data: { status: match.nextMatchId ? "APPROVED" : "CHAMPION" },
            });
            await tx.tournament.update({
              where: { id: match.tournamentId },
              data: { bracketVersion: { increment: 1 } },
            });
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
          if (match.status === "DISPUTED")
            throw new HttpError(
              409,
              "MATCH_DISPUTED",
              "Resolve the dispute before advancing a winner.",
            );
          assertValidWinner(match.gangAId, match.gangBId, input.winnerGangId);
          if (input.gangAScore === input.gangBScore)
            throw new HttpError(
              422,
              "WINNER_REQUIRED",
              "An elimination match cannot finish tied.",
            );
          assertWinnerHasHigherScore(
            match.gangAId,
            input.winnerGangId,
            input.gangAScore,
            input.gangBScore,
            match.bestOf,
          );
          if (match.winnerGangId && match.winnerGangId !== input.winnerGangId) {
            await clearDownstreamWinner(tx, match);
          }
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
                "NEXT_MATCH_NOT_FOUND",
                "The next bracket match no longer exists. Regenerate the bracket.",
              );
            const winnerEntersGangB = Boolean(
              match.position && match.position % 2 === 0,
            );
            const existingQualifier = winnerEntersGangB
              ? next.gangBId
              : next.gangAId;
            const resultInvalidated = Boolean(
              existingQualifier && existingQualifier !== input.winnerGangId,
            );
            if (resultInvalidated && next.winnerGangId) {
              await clearDownstreamWinner(tx, next);
            }
            await tx.match.update({
              where: { id: next.id },
              data: {
                ...(winnerEntersGangB
                  ? { gangBId: input.winnerGangId }
                  : { gangAId: input.winnerGangId }),
                ...(resultInvalidated
                  ? {
                      gangAScore: null,
                      gangBScore: null,
                      winnerGangId: null,
                      status: "SCHEDULED" as const,
                      finalizedAt: null,
                      finalizedByUserId: null,
                      version: { increment: 1 },
                    }
                  : {}),
              },
            });
          }
          if (match.tournamentId) {
            const loserGangId =
              input.winnerGangId === match.gangAId
                ? match.gangBId
                : match.gangAId;
            if (loserGangId) {
              await tx.tournamentParticipant.updateMany({
                where: {
                  tournamentId: match.tournamentId,
                  gangId: loserGangId,
                },
                data: { status: "ELIMINATED" },
              });
            }
            await tx.tournamentParticipant.updateMany({
              where: {
                tournamentId: match.tournamentId,
                gangId: input.winnerGangId,
              },
              data: {
                status: match.nextMatchId ? "APPROVED" : "CHAMPION",
              },
            });
            await tx.tournament.update({
              where: { id: match.tournamentId },
              data: { bracketVersion: { increment: 1 } },
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

  app.get<{ Params: { id: string } }>(
    "/api/v1/admin/matches/:id/downstream-impact",
    async (request) => {
      requirePermission(request, "match.reopen");
      const source = await prisma.match.findUnique({
        where: { id: request.params.id },
      });
      if (!source)
        throw new HttpError(404, "MATCH_NOT_FOUND", "Match was not found.");
      const affected = [];
      let nextId = source.nextMatchId;
      while (nextId) {
        const next = await prisma.match.findUnique({
          where: { id: nextId },
          include: {
            bracketRound: { select: { name: true } },
            gangA: { select: { name: true } },
            gangB: { select: { name: true } },
          },
        });
        if (!next) break;
        affected.push(next);
        nextId = next.nextMatchId;
      }
      return envelope(request, { source, affected });
    },
  );

  app.get("/api/v1/admin/dispute-assignees", async (request) => {
    requirePermission(request, "match.finalize");
    const administrators = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        email: { not: null },
        roles: { some: { gangId: null, role: { status: "ACTIVE" } } },
      },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, email: true },
    });
    return envelope(request, administrators);
  });

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/matches/:id/reopen",
    async (request) => {
      const auth = requirePermission(request, "match.reopen");
      const input = matchReopenSchema.parse(request.body);
      const result = await prisma.$transaction(
        async (tx) => {
          const before = await tx.match.findUnique({
            where: { id: request.params.id },
          });
          if (!before)
            throw new HttpError(404, "MATCH_NOT_FOUND", "Match was not found.");
          if (before.version !== input.version)
            throw new HttpError(
              409,
              "VERSION_CONFLICT",
              "The match changed. Reload it before reopening the result.",
            );
          if (!before.winnerGangId && before.status !== "DISPUTED")
            throw new HttpError(
              409,
              "MATCH_NOT_FINALIZED",
              "Only a finalized or disputed match can be reopened.",
            );
          if (before.winnerGangId) await clearDownstreamWinner(tx, before);
          const updated = await tx.match.update({
            where: { id: before.id, version: input.version },
            data: {
              gangAScore: null,
              gangBScore: null,
              winnerGangId: null,
              status: "AWAITING_RESULT",
              finalizedAt: null,
              finalizedByUserId: null,
              reopenedAt: new Date(),
              reopenReason: input.reason,
              version: { increment: 1 },
            },
          });
          await tx.matchPlayerStat.deleteMany({
            where: { matchId: before.id },
          });
          if (before.tournamentId) {
            await tx.tournamentParticipant.updateMany({
              where: {
                tournamentId: before.tournamentId,
                gangId: {
                  in: [before.gangAId, before.gangBId].filter(
                    (id): id is string => Boolean(id),
                  ),
                },
              },
              data: { status: "APPROVED" },
            });
            await tx.tournament.update({
              where: { id: before.tournamentId },
              data: { bracketVersion: { increment: 1 } },
            });
          }
          return { before, updated };
        },
        { isolationLevel: "Serializable" },
      );
      await writeAudit({
        actorUserId: auth.userId,
        action: "match.reopen",
        entityType: "Match",
        entityId: result.updated.id,
        beforeData: result.before,
        afterData: result.updated,
        reason: input.reason,
      });
      return envelope(request, result.updated);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/matches/:id/dispute",
    async (request) => {
      const auth = requirePermission(request, "match.update");
      const input = disputeSchema.parse(request.body);
      const before = await prisma.match.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      if (before.winnerGangId)
        throw new HttpError(
          409,
          "MATCH_ALREADY_FINALIZED",
          "Reopen the finalized result before marking a dispute.",
        );
      const updated = await prisma.match.update({
        where: { id: before.id },
        data: compact({
          status: "DISPUTED",
          disputeReason: input.reason,
          disputeNotes: input.notes,
          disputeAssignedUserId: input.assignedUserId,
          version: { increment: 1 },
        }),
      });
      await writeAudit({
        actorUserId: auth.userId,
        action: "match.dispute.open",
        entityType: "Match",
        entityId: updated.id,
        beforeData: before,
        afterData: updated,
        reason: input.reason,
      });
      return envelope(request, updated);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/matches/:id/dispute/resolve",
    async (request) => {
      const auth = requirePermission(request, "match.finalize");
      const input = z
        .object({ resolution: z.string().trim().min(5).max(4_000) })
        .parse(request.body);
      const before = await prisma.match.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      if (before.status !== "DISPUTED")
        throw new HttpError(
          409,
          "MATCH_NOT_DISPUTED",
          "This match has no open dispute.",
        );
      const updated = await prisma.match.update({
        where: { id: before.id },
        data: {
          status: "AWAITING_RESULT",
          disputeNotes: [before.disputeNotes, input.resolution]
            .filter(Boolean)
            .join("\n\nResolution: "),
          version: { increment: 1 },
        },
      });
      await writeAudit({
        actorUserId: auth.userId,
        action: "match.dispute.resolve",
        entityType: "Match",
        entityId: updated.id,
        beforeData: before,
        afterData: updated,
        reason: input.resolution,
      });
      return envelope(request, updated);
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
      const before = await prisma.event.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      const startsAt = input.startsAt ?? before.startsAt;
      const endsAt = input.endsAt ?? before.endsAt;
      if (endsAt && endsAt <= startsAt)
        throw new HttpError(
          422,
          "EVENT_DATES_INVALID",
          "Event end time must be after its start time.",
        );
      const event = await prisma.event.update({
        where: { id: request.params.id },
        data: compact({
          ...input,
          archivedAt:
            input.status === "ARCHIVED"
              ? new Date()
              : input.status && before.status === "ARCHIVED"
                ? null
                : undefined,
        }),
      });
      await writeAudit({
        actorUserId: auth.userId,
        action: "event.update",
        entityType: "Event",
        entityId: event.id,
        beforeData: before,
        afterData: event,
      });
      return envelope(request, event);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/events/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "event.manage");
      const event = await prisma.event.update({
        where: { id: request.params.id },
        data: { status: "ARCHIVED", archivedAt: new Date() },
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
        data: { status: "ARCHIVED", archivedAt: new Date() },
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
      where: { email: { not: null }, roles: { some: { gangId: null } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          where: { gangId: null },
          select: { role: { select: { id: true, name: true } } },
        },
      },
    });
    return envelope(request, administrators);
  });

  app.post("/api/v1/admin/administrators", async (request, reply) => {
    const auth = requirePermission(request, "user.manage");
    requirePermission(request, "role.manage");
    const input = administratorCreateSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const roles = await prisma.role.findMany({
      where: { id: { in: input.roleIds }, status: "ACTIVE" },
    });
    if (roles.length !== input.roleIds.length)
      throw new HttpError(
        422,
        "ADMIN_ROLE_INVALID",
        "Select one or more active administrator roles.",
      );
    const administrator = await prisma.user.create({
      data: {
        email: input.email,
        username: input.email.split("@")[0] ?? "administrator",
        displayName: input.displayName,
        passwordHash,
        status: "ACTIVE",
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
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
          roles: {
            where: { gangId: null, role: { name: "Super Administrator" } },
            select: { id: true },
          },
        },
      });
      if (
        before.roles.length > 0 &&
        input.status &&
        input.status !== "ACTIVE"
      ) {
        const otherActiveSuperAdministrators = await prisma.user.count({
          where: {
            id: { not: before.id },
            status: "ACTIVE",
            roles: {
              some: {
                gangId: null,
                role: { name: "Super Administrator", status: "ACTIVE" },
              },
            },
          },
        });
        if (otherActiveSuperAdministrators === 0)
          throw new HttpError(
            409,
            "FINAL_SUPER_ADMIN",
            "Assign another active Super Administrator before suspending or archiving this account.",
          );
      }
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
      const target = await prisma.user.findUniqueOrThrow({
        where: { id: request.params.id },
        select: {
          roles: {
            where: { gangId: null, role: { name: "Super Administrator" } },
            select: { id: true },
          },
        },
      });
      if (target.roles.length > 0) {
        const otherActiveSuperAdministrators = await prisma.user.count({
          where: {
            id: { not: request.params.id },
            status: "ACTIVE",
            roles: {
              some: {
                gangId: null,
                role: { name: "Super Administrator", status: "ACTIVE" },
              },
            },
          },
        });
        if (otherActiveSuperAdministrators === 0)
          throw new HttpError(
            409,
            "FINAL_SUPER_ADMIN",
            "Assign another active Super Administrator before archiving this account.",
          );
      }
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
    requirePermission(request, "audit.configure");
    const config = await getDiscordAuditConfig();
    return envelope(request, {
      enabled: config.enabled,
      configured: Boolean(config.webhookUrl),
      maskedWebhookUrl: maskWebhookUrl(config.webhookUrl),
      categories: config.categories,
    });
  });

  app.put("/api/v1/admin/discord-audit", async (request) => {
    const auth = requirePermission(request, "audit.configure");
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
    const auth = requirePermission(request, "audit.configure");
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

  app.get<{ Querystring: Record<string, string | undefined> }>(
    "/api/v1/admin/audit-logs",
    async (request) => {
      requirePermission(request, "audit.read");
      const input = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(50),
          actorUserId: z.string().min(20).max(40).optional(),
          action: z.string().trim().max(128).optional(),
          entityType: z.string().trim().max(64).optional(),
          entityId: z.string().trim().max(30).optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
        })
        .parse(request.query);
      const dateRange = compact({ gte: input.from, lte: input.to });
      const where = compact({
        actorUserId: input.actorUserId,
        action: input.action ? { contains: input.action } : undefined,
        entityType: input.entityType,
        entityId: input.entityId,
        createdAt:
          input.from || input.to
            ? (dateRange as Prisma.DateTimeFilter)
            : undefined,
      }) as Prisma.AuditLogWhereInput;
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: { actor: { select: { id: true, displayName: true } } },
        }),
        prisma.auditLog.count({ where }),
      ]);
      return envelope(request, logs, {
        page: input.page,
        pageSize: input.pageSize,
        total,
      });
    },
  );
}
