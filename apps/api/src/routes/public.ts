import type { FastifyInstance } from "fastify";
import { gangListQuerySchema, websiteSettingsSchema } from "@mafia/shared";
import { Prisma } from "@prisma/client";
import { envelope } from "../lib/envelope.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { realtimeHub } from "../lib/realtime.js";
import { refreshStaleStreams } from "../lib/stream-status.js";

const gangInclude = {
  memberships: { where: { active: true }, select: { id: true } },
  seasonStats: { orderBy: { updatedAt: "desc" as const }, take: 1 },
  awards: { where: { type: "TOURNAMENT_VICTORY" }, select: { id: true } },
};

const visibleMatchWhere = {
  deletedAt: null,
  AND: [
    {
      OR: [
        { tournamentId: null },
        {
          tournament: {
            status: { not: "ARCHIVED" },
            publicVisible: true,
          },
        },
      ],
    },
    {
      OR: [
        { gangAId: null },
        { gangA: { status: { not: "ARCHIVED" } } },
      ],
    },
    {
      OR: [
        { gangBId: null },
        { gangB: { status: { not: "ARCHIVED" } } },
      ],
    },
  ],
} satisfies Prisma.MatchWhereInput;

function toGangListItem(gang: Awaited<ReturnType<typeof findGangs>>[number]) {
  const stat = gang.seasonStats[0];
  const matches = stat?.matchesPlayed ?? 0;
  return {
    id: gang.id,
    slug: gang.slug,
    name: gang.name,
    tag: gang.tag,
    motto: gang.motto,
    logoUrl: gang.logoUrl,
    bannerUrl: gang.bannerUrl,
    status: gang.status,
    recruitmentStatus: gang.recruitmentStatus,
    verified: gang.verified,
    featured: gang.featured,
    currentRank: gang.currentRank,
    previousRank: gang.previousRank,
    peakRank: gang.peakRank,
    memberCount: gang.memberships.length,
    matchesPlayed: matches,
    wins: stat?.wins ?? 0,
    losses: stat?.losses ?? 0,
    kills: stat?.kills ?? 0,
    winRate:
      matches > 0 ? Math.round(((stat?.wins ?? 0) / matches) * 1000) / 10 : 0,
    trophies: gang.awards.length,
    points: stat?.points ?? 0,
    streak: stat?.streak ?? 0,
    killDifference: (stat?.kills ?? 0) - (stat?.deaths ?? 0),
  };
}

async function findGangs(args: Parameters<typeof prisma.gang.findMany>[0]) {
  return prisma.gang.findMany({ ...args, include: gangInclude });
}

export function publicRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { cursor?: string } }>(
    "/api/v1/realtime",
    async (request, reply) => {
      const parsedCursor = Number.parseInt(request.query.cursor ?? "0", 10);
      const cursor = Number.isFinite(parsedCursor)
        ? Math.max(0, parsedCursor)
        : 0;
      const abortController = new AbortController();
      const abort = () => {
        abortController.abort();
      };
      reply.raw.once("close", abort);
      reply.header("cache-control", "no-store, no-cache, must-revalidate");
      reply.header("x-accel-buffering", "no");
      const snapshot = await realtimeHub.poll(cursor, abortController.signal);
      reply.raw.off("close", abort);
      return envelope(request, snapshot);
    },
  );

  app.get("/api/v1/public/home", async (request) => {
    const [
      registeredGangs,
      registeredPlayers,
      completedMatches,
      activeTournament,
      featuredGangs,
      rankings,
      recentMatches,
      mvp,
    ] = await Promise.all([
      prisma.gang.count({ where: { status: "ACTIVE" } }),
      prisma.player.count({ where: { status: "ACTIVE" } }),
      prisma.match.count({
        where: { ...visibleMatchWhere, status: "COMPLETED" },
      }),
      prisma.tournament.count({ where: { status: "IN_PROGRESS" } }),
      findGangs({
        where: { status: "ACTIVE", featured: true },
        orderBy: { currentRank: "asc" },
        take: 4,
      }),
      findGangs({
        where: { status: "ACTIVE", currentRank: { not: null } },
        orderBy: { currentRank: "asc" },
        take: 5,
      }),
      prisma.match.findMany({
        where: { ...visibleMatchWhere, status: "COMPLETED" },
        orderBy: { finalizedAt: "desc" },
        take: 5,
        include: { gangA: true, gangB: true, winnerGang: true },
      }),
      prisma.mvpAward.findFirst({
        orderBy: { awardedAt: "desc" },
        include: { player: true, gang: true },
      }),
    ]);
    return envelope(request, {
      summary: {
        registeredGangs,
        registeredPlayers,
        completedMatches,
        activeTournament,
      },
      featuredGangs: featuredGangs.map(toGangListItem),
      rankings: rankings.map(toGangListItem),
      recentMatches,
      currentMvp: mvp,
    });
  });

  app.get("/api/v1/gangs", async (request) => {
    const query = gangListQuerySchema.parse(request.query);
    const where = {
      status: query.status ?? "ACTIVE",
      ...(query.recruitment ? { recruitmentStatus: query.recruitment } : {}),
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: "insensitive" as const },
              },
              { tag: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const orderBy =
      query.sort === "name"
        ? { name: "asc" as const }
        : query.sort === "newest"
          ? { createdAt: "desc" as const }
          : { currentRank: "asc" as const };
    const [gangs, total] = await Promise.all([
      findGangs({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.gang.count({ where }),
    ]);
    return envelope(request, gangs.map(toGangListItem), {
      page: query.page,
      pageSize: query.pageSize,
      total,
    });
  });

  app.get<{ Params: { slug: string } }>(
    "/api/v1/gangs/:slug",
    async (request) => {
      const gang = await prisma.gang.findFirst({
        where: { slug: request.params.slug, status: { not: "ARCHIVED" } },
        include: {
          roles: { orderBy: { sortOrder: "asc" } },
          memberships: {
            where: { active: true },
            include: { player: true, gangRole: true },
            orderBy: { gangRole: { sortOrder: "asc" } },
          },
          seasonStats: { orderBy: { updatedAt: "desc" }, take: 1 },
          awards: {
            orderBy: { awardedAt: "desc" },
            take: 20,
            include: { player: true },
          },
        },
      });
      if (!gang)
        throw new HttpError(404, "GANG_NOT_FOUND", "Gang was not found.");
      return envelope(request, gang);
    },
  );

  app.get("/api/v1/players", async (request) => {
    const players = await prisma.player.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
      take: 50,
      include: {
        memberships: {
          where: {
            active: true,
            gang: { status: { not: "ARCHIVED" } },
          },
          include: { gang: true, gangRole: true },
        },
        seasonStats: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    });
    return envelope(request, players);
  });

  app.get<{ Params: { slug: string } }>(
    "/api/v1/players/:slug",
    async (request) => {
      const player = await prisma.player.findFirst({
        where: { slug: request.params.slug, status: { not: "ARCHIVED" } },
        include: {
          memberships: {
            where: { gang: { status: { not: "ARCHIVED" } } },
            include: { gang: true, gangRole: true },
            orderBy: { joinedAt: "desc" },
          },
          seasonStats: { orderBy: { updatedAt: "desc" } },
          awards: {
            orderBy: { awardedAt: "desc" },
            take: 50,
            include: { gang: true, tournament: true, match: true },
          },
          matchStats: {
            orderBy: { createdAt: "desc" },
            take: 25,
            include: {
              match: {
                include: { gangA: true, gangB: true, tournament: true },
              },
            },
          },
        },
      });
      if (!player)
        throw new HttpError(404, "PLAYER_NOT_FOUND", "Player was not found.");
      return envelope(request, player);
    },
  );

  app.get("/api/v1/tournaments", async (request) => {
    const tournaments = await prisma.tournament.findMany({
      where: { status: { not: "ARCHIVED" }, publicVisible: true },
      orderBy: { startAt: "desc" },
      include: {
        _count: {
          select: {
            participants: {
              where: { gang: { status: { not: "ARCHIVED" } } },
            },
          },
        },
        participants: {
          where: {
            status: "CHAMPION",
            gang: { status: { not: "ARCHIVED" } },
          },
          take: 1,
          include: { gang: true },
        },
      },
    });
    return envelope(request, tournaments);
  });

  app.get<{ Params: { slug: string } }>(
    "/api/v1/tournaments/:slug",
    async (request) => {
      const tournament = await prisma.tournament.findFirst({
        where: {
          slug: request.params.slug,
          status: { not: "ARCHIVED" },
          publicVisible: true,
        },
        include: {
          organizer: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
          participants: {
            where: { gang: { status: { not: "ARCHIVED" } } },
            include: { gang: true, roster: { include: { player: true } } },
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

  app.get<{ Params: { slug: string } }>(
    "/api/v1/tournaments/:slug/bracket",
    async (request) => {
      const tournament = await prisma.tournament.findFirst({
        where: {
          slug: request.params.slug,
          status: { not: "ARCHIVED" },
          publicVisible: true,
        },
        select: { id: true, bracketVersion: true },
      });
      if (!tournament)
        throw new HttpError(
          404,
          "TOURNAMENT_NOT_FOUND",
          "Tournament was not found.",
        );
      const rounds = await prisma.bracketRound.findMany({
        where: { tournamentId: tournament.id },
        orderBy: [{ sortOrder: "asc" }, { roundNumber: "asc" }],
        include: {
          matches: {
            where: visibleMatchWhere,
            orderBy: { createdAt: "asc" },
            include: { gangA: true, gangB: true },
          },
        },
      });
      return envelope(request, { version: tournament.bracketVersion, rounds });
    },
  );

  app.get("/api/v1/rankings/gangs", async (request) => {
    const rankings = await findGangs({
      where: { status: "ACTIVE", currentRank: { not: null } },
      orderBy: { currentRank: "asc" },
      take: 100,
    });
    return envelope(request, rankings.map(toGangListItem));
  });

  app.get("/api/v1/rankings/players", async (request) => {
    const season = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { startsAt: "desc" },
    });
    if (!season) return envelope(request, []);
    const rankings = await prisma.playerSeasonStat.findMany({
      where: { seasonId: season.id, player: { status: "ACTIVE" } },
      orderBy: [{ currentRank: "asc" }, { points: "desc" }],
      take: 100,
      include: { player: true },
    });
    return envelope(request, rankings);
  });

  app.get("/api/v1/matches", async (request) => {
    const matches = await prisma.match.findMany({
      where: visibleMatchWhere,
      orderBy: { scheduledAt: "desc" },
      take: 50,
      include: {
        gangA: true,
        gangB: true,
        winnerGang: true,
        tournament: true,
        bracketRound: true,
      },
    });
    return envelope(request, matches);
  });

  app.get("/api/v1/events", async (request) => {
    const events = await prisma.event.findMany({
      where: { status: { notIn: ["DRAFT", "ARCHIVED"] } },
      orderBy: [{ featured: "desc" }, { startsAt: "asc" }],
      take: 100,
    });
    return envelope(request, events);
  });

  app.get("/api/v1/live-streams", async (request) => {
    await refreshStaleStreams();
    const streams = await prisma.liveStream.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: [
        { featured: "desc" },
        { viewerCount: "desc" },
        { updatedAt: "desc" },
      ],
      include: {
        tournament: { select: { id: true, slug: true, name: true } },
      },
      take: 100,
    });
    streams.sort(
      (left, right) =>
        Number(right.status === "LIVE") - Number(left.status === "LIVE") ||
        right.viewerCount - left.viewerCount ||
        Number(right.featured) - Number(left.featured),
    );
    const liveStreams = streams.filter((stream) => stream.status === "LIVE");
    return envelope(request, streams, {
      total: streams.length,
      liveCount: liveStreams.length,
      totalViewers: liveStreams.reduce(
        (total, stream) => total + stream.viewerCount,
        0,
      ),
    });
  });

  app.get<{ Params: { id: string } }>(
    "/api/v1/matches/:id",
    async (request) => {
      const match = await prisma.match.findFirst({
        where: { id: request.params.id, ...visibleMatchWhere },
        include: {
          gangA: true,
          gangB: true,
          winnerGang: true,
          tournament: true,
          bracketRound: true,
          playerStats: { include: { player: true, gang: true } },
          awards: { include: { player: true } },
        },
      });
      if (!match)
        throw new HttpError(404, "MATCH_NOT_FOUND", "Match was not found.");
      return envelope(request, match);
    },
  );

  app.get("/api/v1/seasons", async (request) => {
    const seasons = await prisma.season.findMany({
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });
    return envelope(request, seasons);
  });

  app.get("/api/v1/public/settings", async (request) => {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: "website.structured" },
      select: { value: true, updatedAt: true },
    });
    const parsed = websiteSettingsSchema.safeParse(setting?.value);
    return envelope(request, {
      value: parsed.success ? parsed.data : null,
      updatedAt: setting?.updatedAt ?? null,
    });
  });
}
