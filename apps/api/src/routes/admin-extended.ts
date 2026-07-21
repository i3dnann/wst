import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { permissions, websiteSettingsSchema } from "@mafia/shared";
import { z } from "zod";
import { envelope } from "../lib/envelope.js";
import { env } from "../lib/env.js";
import { recordAudit } from "../lib/audit.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { requirePermission } from "../middleware/authorize.js";
import { calculatePoints } from "../domain/ranking.js";

const id = z.string().min(20).max(40);
const recordStatus = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"]);
const websiteSettingKey = "website.structured";

const gangRoleInput = z.object({
  name: z.string().trim().min(2).max(80),
  hierarchyLevel: z.number().int().min(0).max(1_000),
  public: z.boolean().default(true),
  leadership: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1_000).default(0),
  status: recordStatus.default("ACTIVE"),
});

const membershipInput = z.object({
  playerId: id,
  gangRoleId: id,
  callsign: z.string().trim().max(80).optional(),
  joinedAt: z.coerce.date(),
});

const membershipUpdate = z.object({
  gangRoleId: id.optional(),
  callsign: z.string().trim().max(80).nullable().optional(),
  joinedAt: z.coerce.date().optional(),
  active: z.boolean().optional(),
});

const seasonInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]).default("DRAFT"),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
    scoringConfigSnapshot: z.object({
      win: z.number().int().min(-1_000).max(1_000),
      draw: z.number().int().min(-1_000).max(1_000),
      loss: z.number().int().min(-1_000).max(1_000),
      kill: z.number().int().min(-1_000).max(1_000),
      mvp: z.number().int().min(-1_000).max(1_000),
      tournamentVictory: z.number().int().min(-10_000).max(10_000),
    }),
  })
  .superRefine((value, context) => {
    if (value.endsAt && value.endsAt <= value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Season end time must be after its start time.",
      });
    }
  });

const roleInput = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2_000).nullable().optional(),
  status: recordStatus.default("ACTIVE"),
});

const mediaCompleteInput = z.object({
  mediaAssetId: id,
  width: z.number().int().min(64).max(20_000),
  height: z.number().int().min(64).max(20_000),
});

const defaultWebsiteSettings = {
  general: {
    websiteName: "World Star Registry",
    shortName: "WST",
    description: "The official World Star gang and tournament registry.",
    logoUrl: "",
    faviconUrl: "",
    defaultLanguage: "en",
    timeZone: "Europe/Berlin",
    maintenanceMode: false,
  },
  homepage: {
    heroTitle: "WORLD STAR",
    heroSubtitle: "Loyalty. Power. Respect.",
    heroMediaUrl: "",
    announcement: "",
  },
  tournament: {
    defaultBestOf: 1,
    defaultParticipantCapacity: 16,
    registrationRules: "",
    checkInDurationMinutes: 30,
    resultSubmissionMinutes: 60,
  },
  branding: {
    primaryColor: "#b88a44",
    secondaryColor: "#5b3a20",
    accentColor: "#d3ad68",
    backgroundMediaUrl: "",
    animationIntensity: "NORMAL" as const,
  },
  social: {},
};

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function compact(input: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

export function adminExtendedRoutes(app: FastifyInstance): void {
  app.get("/api/v1/admin/website-settings", async (request) => {
    requirePermission(request, "settings.manage");
    const setting = await prisma.platformSetting.findUnique({
      where: { key: websiteSettingKey },
    });
    const parsed = websiteSettingsSchema.safeParse(
      setting?.value ?? defaultWebsiteSettings,
    );
    return envelope(
      request,
      parsed.success ? parsed.data : defaultWebsiteSettings,
    );
  });

  app.put("/api/v1/admin/website-settings", async (request) => {
    const auth = requirePermission(request, "settings.manage");
    const input = websiteSettingsSchema.parse(request.body);
    const before = await prisma.platformSetting.findUnique({
      where: { key: websiteSettingKey },
    });
    const setting = await prisma.platformSetting.upsert({
      where: { key: websiteSettingKey },
      update: { value: json(input), updatedByUserId: auth.userId },
      create: {
        key: websiteSettingKey,
        value: json(input),
        updatedByUserId: auth.userId,
      },
    });
    await recordAudit({
      actorUserId: auth.userId,
      action: "setting.website.update",
      entityType: "PlatformSetting",
      entityId: setting.id,
      beforeData: before,
      afterData: setting,
    });
    return envelope(request, input);
  });

  app.get<{ Params: { gangId: string } }>(
    "/api/v1/admin/gangs/:gangId/roles",
    async (request) => {
      requirePermission(request, "gang.roster.manage.any");
      const roles = await prisma.gangRole.findMany({
        where: { gangId: request.params.gangId },
        orderBy: [{ sortOrder: "asc" }, { hierarchyLevel: "desc" }],
      });
      return envelope(request, roles);
    },
  );

  app.post<{ Params: { gangId: string } }>(
    "/api/v1/admin/gangs/:gangId/roles",
    async (request, reply) => {
      const auth = requirePermission(request, "gang.roster.manage.any");
      const input = gangRoleInput.parse(request.body);
      const role = await prisma.gangRole.create({
        data: {
          ...input,
          gangId: request.params.gangId,
          archivedAt: input.status === "ARCHIVED" ? new Date() : null,
        },
      });
      await recordAudit({
        actorUserId: auth.userId,
        action: "gang.role.create",
        entityType: "GangRole",
        entityId: role.id,
        afterData: role,
      });
      return reply.code(201).send(envelope(request, role));
    },
  );

  app.patch<{ Params: { gangId: string; roleId: string } }>(
    "/api/v1/admin/gangs/:gangId/roles/:roleId",
    async (request) => {
      const auth = requirePermission(request, "gang.roster.manage.any");
      const input = gangRoleInput.partial().parse(request.body);
      const before = await prisma.gangRole.findFirst({
        where: { id: request.params.roleId, gangId: request.params.gangId },
      });
      if (!before)
        throw new HttpError(
          404,
          "GANG_ROLE_NOT_FOUND",
          "Gang role was not found.",
        );
      const role = await prisma.gangRole.update({
        where: { id: before.id },
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
      await recordAudit({
        actorUserId: auth.userId,
        action: "gang.role.update",
        entityType: "GangRole",
        entityId: role.id,
        beforeData: before,
        afterData: role,
      });
      return envelope(request, role);
    },
  );

  app.delete<{ Params: { gangId: string; roleId: string } }>(
    "/api/v1/admin/gangs/:gangId/roles/:roleId",
    async (request, reply) => {
      const auth = requirePermission(request, "gang.roster.manage.any");
      const activeMemberships = await prisma.gangMembership.count({
        where: { gangRoleId: request.params.roleId, active: true },
      });
      if (activeMemberships > 0)
        throw new HttpError(
          409,
          "GANG_ROLE_IN_USE",
          "Move active members to another role before archiving this role.",
          { activeMemberships },
        );
      const role = await prisma.gangRole.update({
        where: { id: request.params.roleId },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      await recordAudit({
        actorUserId: auth.userId,
        action: "gang.role.archive",
        entityType: "GangRole",
        entityId: role.id,
        afterData: role,
      });
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { gangId: string } }>(
    "/api/v1/admin/gangs/:gangId/memberships",
    async (request) => {
      requirePermission(request, "gang.roster.manage.any");
      const memberships = await prisma.gangMembership.findMany({
        where: { gangId: request.params.gangId },
        orderBy: [{ active: "desc" }, { joinedAt: "desc" }],
        include: { player: true, gangRole: true },
      });
      return envelope(request, memberships);
    },
  );

  app.post<{ Params: { gangId: string } }>(
    "/api/v1/admin/gangs/:gangId/memberships",
    async (request, reply) => {
      const auth = requirePermission(request, "gang.roster.manage.any");
      const input = membershipInput.parse(request.body);
      const membership = await prisma.$transaction(
        async (tx) => {
          const role = await tx.gangRole.findFirst({
            where: {
              id: input.gangRoleId,
              gangId: request.params.gangId,
              status: "ACTIVE",
            },
          });
          if (!role)
            throw new HttpError(
              422,
              "GANG_ROLE_INVALID",
              "Select an active role belonging to this gang.",
            );
          await tx.gangMembership.updateMany({
            where: { playerId: input.playerId, active: true },
            data: { active: false, leftAt: input.joinedAt },
          });
          return tx.gangMembership.create({
            data: compact({
              gangId: request.params.gangId,
              ...input,
            }) as Prisma.GangMembershipUncheckedCreateInput,
            include: { player: true, gangRole: true },
          });
        },
        { isolationLevel: "Serializable" },
      );
      await recordAudit({
        actorUserId: auth.userId,
        action: "gang.membership.add",
        entityType: "GangMembership",
        entityId: membership.id,
        afterData: membership,
      });
      return reply.code(201).send(envelope(request, membership));
    },
  );

  app.patch<{ Params: { gangId: string; membershipId: string } }>(
    "/api/v1/admin/gangs/:gangId/memberships/:membershipId",
    async (request) => {
      const auth = requirePermission(request, "gang.roster.manage.any");
      const input = membershipUpdate.parse(request.body);
      const result = await prisma.$transaction(
        async (tx) => {
          const before = await tx.gangMembership.findFirst({
            where: {
              id: request.params.membershipId,
              gangId: request.params.gangId,
            },
          });
          if (!before)
            throw new HttpError(
              404,
              "MEMBERSHIP_NOT_FOUND",
              "Membership was not found.",
            );
          if (input.gangRoleId) {
            const role = await tx.gangRole.findFirst({
              where: {
                id: input.gangRoleId,
                gangId: request.params.gangId,
                status: "ACTIVE",
              },
            });
            if (!role)
              throw new HttpError(
                422,
                "GANG_ROLE_INVALID",
                "Select an active role belonging to this gang.",
              );
          }
          if (input.active === true) {
            await tx.gangMembership.updateMany({
              where: {
                playerId: before.playerId,
                active: true,
                id: { not: before.id },
              },
              data: { active: false, leftAt: new Date() },
            });
          }
          const updated = await tx.gangMembership.update({
            where: { id: before.id },
            data: compact({
              ...input,
              leftAt:
                input.active === true
                  ? null
                  : input.active === false
                    ? new Date()
                    : undefined,
            }),
            include: { player: true, gangRole: true },
          });
          return { before, updated };
        },
        { isolationLevel: "Serializable" },
      );
      await recordAudit({
        actorUserId: auth.userId,
        action: result.updated.active
          ? "gang.membership.update"
          : "gang.membership.remove",
        entityType: "GangMembership",
        entityId: result.updated.id,
        beforeData: result.before,
        afterData: result.updated,
      });
      return envelope(request, result.updated);
    },
  );

  app.delete<{ Params: { gangId: string; membershipId: string } }>(
    "/api/v1/admin/gangs/:gangId/memberships/:membershipId",
    async (request, reply) => {
      const auth = requirePermission(request, "gang.roster.manage.any");
      const before = await prisma.gangMembership.findFirst({
        where: {
          id: request.params.membershipId,
          gangId: request.params.gangId,
        },
      });
      if (!before)
        throw new HttpError(
          404,
          "MEMBERSHIP_NOT_FOUND",
          "Membership was not found.",
        );
      const updated = await prisma.gangMembership.update({
        where: { id: before.id },
        data: { active: false, leftAt: new Date() },
      });
      await recordAudit({
        actorUserId: auth.userId,
        action: "gang.membership.remove",
        entityType: "GangMembership",
        entityId: updated.id,
        beforeData: before,
        afterData: updated,
      });
      return reply.code(204).send();
    },
  );

  app.get("/api/v1/admin/seasons", async (request) => {
    requirePermission(request, "season.manage");
    const seasons = await prisma.season.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        _count: {
          select: { tournaments: true, gangStats: true, playerStats: true },
        },
      },
    });
    return envelope(request, seasons);
  });

  app.post("/api/v1/admin/seasons", async (request, reply) => {
    const auth = requirePermission(request, "season.manage");
    const input = seasonInput.parse(request.body);
    const season = await prisma.$transaction(async (tx) => {
      if (input.status === "ACTIVE")
        await tx.season.updateMany({
          where: { status: "ACTIVE" },
          data: { status: "CLOSED" },
        });
      return tx.season.create({
        data: compact({
          ...input,
          scoringConfigSnapshot: json(input.scoringConfigSnapshot),
          archivedAt: input.status === "ARCHIVED" ? new Date() : null,
        }) as Prisma.SeasonUncheckedCreateInput,
      });
    });
    await recordAudit({
      actorUserId: auth.userId,
      action: "season.create",
      entityType: "Season",
      entityId: season.id,
      afterData: season,
    });
    return reply.code(201).send(envelope(request, season));
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/seasons/:id",
    async (request) => {
      const auth = requirePermission(request, "season.manage");
      const input = seasonInput.partial().parse(request.body);
      const result = await prisma.$transaction(async (tx) => {
        const before = await tx.season.findUniqueOrThrow({
          where: { id: request.params.id },
        });
        if (input.status === "ACTIVE")
          await tx.season.updateMany({
            where: { status: "ACTIVE", id: { not: before.id } },
            data: { status: "CLOSED" },
          });
        const updated = await tx.season.update({
          where: { id: before.id },
          data: compact({
            ...input,
            scoringConfigSnapshot: input.scoringConfigSnapshot
              ? json(input.scoringConfigSnapshot)
              : undefined,
            archivedAt:
              input.status === "ARCHIVED"
                ? new Date()
                : input.status && before.status === "ARCHIVED"
                  ? null
                  : undefined,
          }),
        });
        return { before, updated };
      });
      await recordAudit({
        actorUserId: auth.userId,
        action: "season.update",
        entityType: "Season",
        entityId: result.updated.id,
        beforeData: result.before,
        afterData: result.updated,
      });
      return envelope(request, result.updated);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/seasons/:id/recalculate",
    async (request) => {
      const auth = requirePermission(request, "ranking.configure");
      const result = await prisma.$transaction(
        async (tx) => {
          const season = await tx.season.findUnique({
            where: { id: request.params.id },
          });
          if (!season)
            throw new HttpError(
              404,
              "SEASON_NOT_FOUND",
              "Season was not found.",
            );
          const config = seasonInput.shape.scoringConfigSnapshot.parse(
            season.scoringConfigSnapshot,
          );
          const matches = await tx.match.findMany({
            where: {
              status: "COMPLETED",
              finalizedAt: {
                gte: season.startsAt,
                ...(season.endsAt ? { lte: season.endsAt } : {}),
              },
              OR: [
                { tournament: { seasonId: season.id } },
                { tournamentId: null },
              ],
            },
            include: { playerStats: true },
          });
          const previousGang = new Map(
            (
              await tx.gangSeasonStat.findMany({
                where: { seasonId: season.id },
              })
            ).map((stat) => [stat.gangId, stat]),
          );
          const previousPlayer = new Map(
            (
              await tx.playerSeasonStat.findMany({
                where: { seasonId: season.id },
              })
            ).map((stat) => [stat.playerId, stat]),
          );
          const gangRows = new Map<
            string,
            {
              gangId: string;
              matchesPlayed: number;
              wins: number;
              losses: number;
              draws: number;
              kills: number;
              deaths: number;
              tournamentVictories: number;
              adjustment: number;
            }
          >();
          const playerRows = new Map<
            string,
            {
              playerId: string;
              gangId: string | null;
              matchesPlayed: number;
              wins: number;
              losses: number;
              kills: number;
              deaths: number;
              assists: number;
              mvpAwards: number;
            }
          >();
          const gangRow = (gangId: string) => {
            const current = gangRows.get(gangId) ?? {
              gangId,
              matchesPlayed: 0,
              wins: 0,
              losses: 0,
              draws: 0,
              kills: 0,
              deaths: 0,
              tournamentVictories: 0,
              adjustment: 0,
            };
            gangRows.set(gangId, current);
            return current;
          };
          for (const match of matches) {
            const gangIds = [match.gangAId, match.gangBId].filter(
              (value): value is string => Boolean(value),
            );
            for (const gangId of gangIds) {
              const row = gangRow(gangId);
              row.matchesPlayed += 1;
              if (match.winnerGangId === gangId) row.wins += 1;
              else if (match.winnerGangId) row.losses += 1;
              else row.draws += 1;
            }
            for (const stat of match.playerStats) {
              const gang = gangRow(stat.gangId);
              gang.kills += stat.kills;
              gang.deaths += stat.deaths;
              const player = playerRows.get(stat.playerId) ?? {
                playerId: stat.playerId,
                gangId: stat.gangId,
                matchesPlayed: 0,
                wins: 0,
                losses: 0,
                kills: 0,
                deaths: 0,
                assists: 0,
                mvpAwards: 0,
              };
              player.matchesPlayed += stat.played ? 1 : 0;
              player.wins += match.winnerGangId === stat.gangId ? 1 : 0;
              player.losses +=
                match.winnerGangId && match.winnerGangId !== stat.gangId
                  ? 1
                  : 0;
              player.kills += stat.kills;
              player.deaths += stat.deaths;
              player.assists += stat.assists;
              player.mvpAwards += stat.mvp ? 1 : 0;
              playerRows.set(stat.playerId, player);
            }
          }
          const champions = await tx.tournamentParticipant.groupBy({
            by: ["gangId"],
            where: { tournament: { seasonId: season.id }, status: "CHAMPION" },
            _count: { gangId: true },
          });
          for (const champion of champions)
            gangRow(champion.gangId).tournamentVictories =
              champion._count.gangId;
          const adjustments = await tx.rankingEvent.groupBy({
            by: ["entityId"],
            where: { seasonId: season.id, entityType: "GANG" },
            _sum: { points: true },
          });
          for (const adjustment of adjustments)
            gangRow(adjustment.entityId).adjustment =
              adjustment._sum.points ?? 0;
          const rankedGangs = [...gangRows.values()]
            .map((row) => ({
              ...row,
              points: calculatePoints(
                {
                  wins: row.wins,
                  draws: row.draws,
                  losses: row.losses,
                  kills: row.kills,
                  mvpAwards: 0,
                  tournamentVictories: row.tournamentVictories,
                  adjustment: row.adjustment,
                },
                config,
              ),
            }))
            .sort(
              (left, right) =>
                right.points - left.points ||
                right.wins - left.wins ||
                right.kills - right.deaths - (left.kills - left.deaths) ||
                left.gangId.localeCompare(right.gangId),
            );
          const rankedPlayers = [...playerRows.values()]
            .map((row) => ({
              ...row,
              points: calculatePoints(
                {
                  wins: row.wins,
                  draws: 0,
                  losses: row.losses,
                  kills: row.kills,
                  mvpAwards: row.mvpAwards,
                  tournamentVictories: 0,
                  adjustment: 0,
                },
                config,
              ),
            }))
            .sort(
              (left, right) =>
                right.points - left.points ||
                right.wins - left.wins ||
                right.kills - left.kills ||
                left.playerId.localeCompare(right.playerId),
            );
          await tx.gangSeasonStat.deleteMany({
            where: { seasonId: season.id },
          });
          await tx.playerSeasonStat.deleteMany({
            where: { seasonId: season.id },
          });
          if (rankedGangs.length)
            await tx.gangSeasonStat.createMany({
              data: rankedGangs.map((row, index) => ({
                seasonId: season.id,
                gangId: row.gangId,
                matchesPlayed: row.matchesPlayed,
                wins: row.wins,
                losses: row.losses,
                draws: row.draws,
                kills: row.kills,
                deaths: row.deaths,
                points: row.points,
                currentRank: index + 1,
                previousRank: previousGang.get(row.gangId)?.currentRank ?? null,
                peakRank: Math.min(
                  previousGang.get(row.gangId)?.peakRank ?? index + 1,
                  index + 1,
                ),
              })),
            });
          if (rankedPlayers.length)
            await tx.playerSeasonStat.createMany({
              data: rankedPlayers.map((row, index) => ({
                seasonId: season.id,
                playerId: row.playerId,
                gangId: row.gangId,
                matchesPlayed: row.matchesPlayed,
                wins: row.wins,
                losses: row.losses,
                kills: row.kills,
                deaths: row.deaths,
                assists: row.assists,
                mvpAwards: row.mvpAwards,
                points: row.points,
                currentRank: index + 1,
                previousRank:
                  previousPlayer.get(row.playerId)?.currentRank ?? null,
                peakRank: Math.min(
                  previousPlayer.get(row.playerId)?.peakRank ?? index + 1,
                  index + 1,
                ),
              })),
            });
          if (season.status === "ACTIVE") {
            for (const [index, row] of rankedGangs.entries())
              await tx.gang.update({
                where: { id: row.gangId },
                data: {
                  previousRank:
                    previousGang.get(row.gangId)?.currentRank ?? null,
                  currentRank: index + 1,
                  peakRank: Math.min(
                    previousGang.get(row.gangId)?.peakRank ?? index + 1,
                    index + 1,
                  ),
                },
              });
          }
          return {
            seasonId: season.id,
            matches: matches.length,
            gangs: rankedGangs.length,
            players: rankedPlayers.length,
          };
        },
        { isolationLevel: "Serializable", timeout: 30_000 },
      );
      await recordAudit({
        actorUserId: auth.userId,
        action: "ranking.recalculate",
        entityType: "Season",
        entityId: request.params.id,
        afterData: result,
      });
      return envelope(request, result);
    },
  );

  app.get("/api/v1/admin/roles", async (request) => {
    requirePermission(request, "role.manage");
    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    const availablePermissions = await prisma.permission.findMany({
      orderBy: { key: "asc" },
    });
    return envelope(request, { roles, permissions: availablePermissions });
  });

  app.post("/api/v1/admin/roles", async (request, reply) => {
    const auth = requirePermission(request, "role.manage");
    const input = roleInput.parse(request.body);
    const role = await prisma.role.create({
      data: compact(input) as Prisma.RoleUncheckedCreateInput,
    });
    await recordAudit({
      actorUserId: auth.userId,
      action: "role.create",
      entityType: "Role",
      entityId: role.id,
      afterData: role,
    });
    return reply.code(201).send(envelope(request, role));
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/roles/:id",
    async (request) => {
      const auth = requirePermission(request, "role.manage");
      const input = roleInput.partial().parse(request.body);
      const before = await prisma.role.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      if (
        before.name === "Super Administrator" &&
        input.status &&
        input.status !== "ACTIVE"
      )
        throw new HttpError(
          409,
          "SUPER_ROLE_PROTECTED",
          "The Super Administrator role cannot be disabled.",
        );
      const role = await prisma.role.update({
        where: { id: before.id },
        data: compact(input),
      });
      await recordAudit({
        actorUserId: auth.userId,
        action: "role.update",
        entityType: "Role",
        entityId: role.id,
        beforeData: before,
        afterData: role,
      });
      return envelope(request, role);
    },
  );

  app.put<{ Params: { id: string } }>(
    "/api/v1/admin/roles/:id/permissions",
    async (request) => {
      const auth = requirePermission(request, "role.manage");
      const input = z
        .object({
          permissionIds: z.array(id).max(Object.keys(permissions).length),
        })
        .parse(request.body);
      const role = await prisma.role.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      if (role.name === "Super Administrator")
        throw new HttpError(
          409,
          "SUPER_ROLE_PROTECTED",
          "The Super Administrator role always receives every permission from the seed.",
        );
      await prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (input.permissionIds.length)
          await tx.rolePermission.createMany({
            data: input.permissionIds.map((permissionId) => ({
              roleId: role.id,
              permissionId,
            })),
          });
      });
      await recordAudit({
        actorUserId: auth.userId,
        action: "role.permissions.update",
        entityType: "Role",
        entityId: role.id,
        afterData: { permissionIds: input.permissionIds },
      });
      return envelope(request, {
        roleId: role.id,
        permissionIds: input.permissionIds,
      });
    },
  );

  app.put<{ Params: { id: string } }>(
    "/api/v1/admin/administrators/:id/roles",
    async (request) => {
      const auth = requirePermission(request, "role.manage");
      const input = z
        .object({
          roleIds: z
            .array(id)
            .min(1)
            .max(20)
            .refine(
              (values) => new Set(values).size === values.length,
              "Role assignments must be unique.",
            ),
        })
        .parse(request.body);
      await prisma.$transaction(
        async (tx) => {
          const target = await tx.user.findUnique({
            where: { id: request.params.id },
            select: { id: true },
          });
          if (!target)
            throw new HttpError(
              404,
              "ADMIN_NOT_FOUND",
              "Administrator not found.",
            );
          const validRoles = await tx.role.count({
            where: { id: { in: input.roleIds }, status: "ACTIVE" },
          });
          if (validRoles !== input.roleIds.length)
            throw new HttpError(
              422,
              "ROLE_INVALID",
              "One or more selected roles are unavailable.",
            );
          const superRole = await tx.role.findUnique({
            where: { name: "Super Administrator" },
            select: { id: true },
          });
          if (superRole) {
            const targetHasSuperRole = await tx.userRole.count({
              where: {
                userId: request.params.id,
                roleId: superRole.id,
                gangId: null,
              },
            });
            const keepsSuperRole = input.roleIds.includes(superRole.id);
            if (targetHasSuperRole > 0 && !keepsSuperRole) {
              const otherSuperAdministrators = await tx.userRole.count({
                where: {
                  roleId: superRole.id,
                  gangId: null,
                  userId: { not: request.params.id },
                  user: { status: "ACTIVE" },
                },
              });
              if (otherSuperAdministrators === 0)
                throw new HttpError(
                  409,
                  "FINAL_SUPER_ADMIN",
                  "Assign another active Super Administrator before removing this final assignment.",
                );
            }
          }
          await tx.userRole.deleteMany({
            where: { userId: request.params.id, gangId: null },
          });
          await tx.userRole.createMany({
            data: input.roleIds.map((roleId) => ({
              userId: request.params.id,
              roleId,
            })),
          });
          await tx.refreshToken.updateMany({
            where: { userId: request.params.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        },
        { isolationLevel: "Serializable" },
      );
      await recordAudit({
        actorUserId: auth.userId,
        action: "admin.roles.update",
        entityType: "User",
        entityId: request.params.id,
        afterData: { roleIds: input.roleIds },
      });
      return envelope(request, {
        userId: request.params.id,
        roleIds: input.roleIds,
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/administrators/:id/sessions",
    async (request, reply) => {
      const auth = requirePermission(request, "user.manage");
      const result = await prisma.refreshToken.updateMany({
        where: { userId: request.params.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await recordAudit({
        actorUserId: auth.userId,
        action: "admin.sessions.revoke",
        entityType: "User",
        entityId: request.params.id,
        afterData: { revokedSessions: result.count },
      });
      return reply.code(204).send();
    },
  );

  app.get("/api/v1/admin/media", async (request) => {
    requirePermission(request, "media.moderate");
    const media = await prisma.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        uploader: { select: { displayName: true, email: true } },
        gang: { select: { name: true, tag: true } },
        reviewedBy: { select: { displayName: true } },
      },
    });
    return envelope(request, media);
  });

  app.post("/api/v1/admin/media/complete", async (request, reply) => {
    const auth = requirePermission(request, "media.upload");
    const input = mediaCompleteInput.parse(request.body);
    const before = await prisma.mediaAsset.findFirst({
      where: {
        id: input.mediaAssetId,
        uploaderUserId: auth.userId,
        status: "PENDING",
      },
    });
    if (!before)
      throw new HttpError(
        404,
        "MEDIA_UPLOAD_NOT_FOUND",
        "This pending media upload does not exist or belongs to another administrator.",
      );
    const media = await prisma.mediaAsset.update({
      where: { id: before.id },
      data: compact({ width: input.width, height: input.height }),
    });
    await recordAudit({
      actorUserId: auth.userId,
      action: "media.upload.complete",
      entityType: "MediaAsset",
      entityId: media.id,
      beforeData: before,
      afterData: media,
    });
    return reply.code(200).send(envelope(request, media));
  });

  app.patch<{ Params: { id: string } }>(
    "/api/v1/admin/media/:id",
    async (request) => {
      const auth = requirePermission(request, "media.moderate");
      const input = z
        .object({
          status: z.enum(["PENDING", "APPROVED", "REJECTED", "ARCHIVED"]),
        })
        .parse(request.body);
      const before = await prisma.mediaAsset.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      const media = await prisma.mediaAsset.update({
        where: { id: before.id },
        data: {
          status: input.status,
          reviewedAt: new Date(),
          reviewedByUserId: auth.userId,
        },
      });
      await recordAudit({
        actorUserId: auth.userId,
        action: `media.${input.status.toLowerCase()}`,
        entityType: "MediaAsset",
        entityId: media.id,
        beforeData: before,
        afterData: media,
      });
      return envelope(request, media);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/admin/media/:id",
    async (request, reply) => {
      const auth = requirePermission(request, "media.delete");
      const before = await prisma.mediaAsset.findUniqueOrThrow({
        where: { id: request.params.id },
      });
      const references = await Promise.all([
        prisma.gang.count({
          where: {
            OR: [
              { logoUrl: before.publicUrl },
              { bannerUrl: before.publicUrl },
            ],
          },
        }),
        prisma.player.count({ where: { avatarUrl: before.publicUrl } }),
        prisma.tournament.count({ where: { bannerUrl: before.publicUrl } }),
        prisma.event.count({ where: { imageUrl: before.publicUrl } }),
      ]);
      if (references.some((count) => count > 0))
        throw new HttpError(
          409,
          "MEDIA_IN_USE",
          "Replace this media everywhere it is used before deleting its record.",
          { references },
        );
      await prisma.mediaAsset.delete({ where: { id: before.id } });
      await recordAudit({
        actorUserId: auth.userId,
        action: "media.delete",
        entityType: "MediaAsset",
        entityId: before.id,
        beforeData: before,
        reason: "Unreferenced media record permanently deleted.",
      });
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { resource: string; id: string } }>(
    "/api/v1/admin/:resource/:id/restore",
    async (request) => {
      const resource = request.params.resource;
      let restored: object;
      let permission: Parameters<typeof requirePermission>[1];
      if (resource === "gangs") {
        permission = "gang.archive";
        requirePermission(request, permission);
        restored = await prisma.gang.update({
          where: { id: request.params.id },
          data: { status: "ACTIVE", archivedAt: null },
        });
      } else if (resource === "players") {
        permission = "player.archive";
        requirePermission(request, permission);
        restored = await prisma.player.update({
          where: { id: request.params.id },
          data: { status: "ACTIVE", archivedAt: null },
        });
      } else if (resource === "tournaments") {
        permission = "tournament.archive";
        requirePermission(request, permission);
        restored = await prisma.tournament.update({
          where: { id: request.params.id },
          data: { status: "DRAFT", archivedAt: null },
        });
      } else if (resource === "events") {
        permission = "event.manage";
        requirePermission(request, permission);
        restored = await prisma.event.update({
          where: { id: request.params.id },
          data: { status: "DRAFT", archivedAt: null },
        });
      } else if (resource === "live-streams") {
        permission = "stream.manage";
        requirePermission(request, permission);
        restored = await prisma.liveStream.update({
          where: { id: request.params.id },
          data: { status: "OFFLINE", archivedAt: null },
        });
      } else {
        throw new HttpError(
          404,
          "RESOURCE_NOT_FOUND",
          "This resource cannot be restored.",
        );
      }
      const auth = requirePermission(request, permission);
      await recordAudit({
        actorUserId: auth.userId,
        action: `${resource}.restore`,
        entityType: resource,
        entityId: request.params.id,
        afterData: restored,
      });
      return envelope(request, restored);
    },
  );

  app.get("/api/v1/admin/system-health", async (request) => {
    requirePermission(request, "system.health.read");
    const checkedAt = new Date();
    const started = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const databaseLatencyMs = Math.round(performance.now() - started);
    const [discord, streamErrors, migrations] = await Promise.all([
      prisma.platformSetting.findUnique({
        where: { key: "discord.audit" },
        select: { value: true, updatedAt: true },
      }),
      prisma.liveStream.findMany({
        where: { lastStatusError: { not: null }, status: { not: "ARCHIVED" } },
        orderBy: { lastCheckedAt: "desc" },
        take: 10,
        select: {
          id: true,
          streamerName: true,
          platform: true,
          lastCheckedAt: true,
          lastStatusError: true,
        },
      }),
      prisma.$queryRaw<
        Array<{ migration_name: string; finished_at: Date | null }>
      >`SELECT migration_name, finished_at FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY finished_at DESC LIMIT 1`,
    ]);
    const discordValue =
      discord?.value &&
      typeof discord.value === "object" &&
      !Array.isArray(discord.value)
        ? (discord.value as Record<string, unknown>)
        : {};
    return envelope(request, {
      api: "available",
      database: "available",
      databaseLatencyMs,
      checkedAt,
      environment: env.NODE_ENV,
      version: process.env.npm_package_version ?? "0.1.0",
      buildCommit: process.env.BUILD_COMMIT ?? "not-provided",
      migration: migrations[0]
        ? {
            name: migrations[0].migration_name,
            finishedAt: migrations[0].finished_at,
          }
        : null,
      providers: {
        twitch: Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET),
        youtube: Boolean(env.YOUTUBE_API_KEY),
        kick: true,
      },
      mediaStorageConfigured: Boolean(
        env.S3_ENDPOINT &&
        env.S3_BUCKET &&
        env.S3_ACCESS_KEY_ID &&
        env.S3_SECRET_ACCESS_KEY &&
        env.S3_PUBLIC_BASE_URL,
      ),
      discordAuditEnabled: discordValue.enabled === true,
      discordSettingsUpdatedAt: discord?.updatedAt ?? null,
      recentProviderErrors: streamErrors,
    });
  });
}
