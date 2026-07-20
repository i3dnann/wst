import { z } from "zod";

export const permissions = {
  gangRead: "gang.read",
  gangCreate: "gang.create",
  gangUpdateOwn: "gang.update.own",
  gangUpdateAny: "gang.update.any",
  gangRosterOwn: "gang.roster.manage.own",
  gangRosterAny: "gang.roster.manage.any",
  tournamentRead: "tournament.read",
  tournamentCreate: "tournament.create",
  tournamentUpdate: "tournament.update",
  bracketManage: "tournament.bracket.manage",
  matchCreate: "match.create",
  matchUpdate: "match.update",
  matchFinalize: "match.finalize",
  matchReopen: "match.reopen",
  rankingConfigure: "ranking.configure",
  mediaModerate: "media.moderate",
  userManage: "user.manage",
  roleManage: "role.manage",
  auditRead: "audit.read",
  settingsManage: "settings.manage",
  eventManage: "event.manage",
  streamManage: "stream.manage",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

export const idSchema = z.string().min(20).max(40);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const gangListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(80).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
  recruitment: z.enum(["OPEN", "CLOSED", "INVITE_ONLY"]).optional(),
  sort: z
    .enum(["rank", "wins", "kills", "winRate", "name", "newest"])
    .default("rank"),
});

export const matchResultSchema = z.object({
  version: z.number().int().min(0),
  gangAScore: z.number().int().min(0).max(99),
  gangBScore: z.number().int().min(0).max(99),
  winnerGangId: idSchema,
  playerStats: z.array(
    z.object({
      playerId: idSchema,
      gangId: idSchema,
      kills: z.number().int().min(0).max(999),
      deaths: z.number().int().min(0).max(999),
      assists: z.number().int().min(0).max(999),
      roundsPlayed: z.number().int().min(0).max(99),
      mvp: z.boolean().default(false),
    }),
  ),
});

export const adminLoginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

export interface ApiEnvelope<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export interface HomeSummary {
  registeredGangs: number;
  registeredPlayers: number;
  completedMatches: number;
  activeTournament: number;
}

export interface GangListItem {
  id: string;
  slug: string;
  name: string;
  tag: string;
  motto: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  status: string;
  recruitmentStatus: string;
  verified: boolean;
  featured: boolean;
  currentRank: number | null;
  memberCount: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  winRate: number;
  trophies: number;
}

export interface BracketMatch {
  id: string;
  round: string;
  gangA: { id: string; name: string; logoUrl: string | null } | null;
  gangB: { id: string; name: string; logoUrl: string | null } | null;
  gangAScore: number | null;
  gangBScore: number | null;
  winnerGangId: string | null;
  status: string;
  scheduledAt: string | null;
  nextMatchId: string | null;
}

export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  featured: boolean;
}

export interface PublicLiveStream {
  id: string;
  slug: string;
  streamerName: string;
  platform: string;
  channelUrl: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  featured: boolean;
  startsAt: string | null;
  tournament: { id: string; slug: string; name: string } | null;
}
