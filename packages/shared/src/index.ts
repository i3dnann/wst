import { z } from "zod";

export const permissions = {
  gangRead: "gang.read",
  gangCreate: "gang.create",
  gangArchive: "gang.archive",
  gangDelete: "gang.delete",
  gangUpdateOwn: "gang.update.own",
  gangUpdateAny: "gang.update.any",
  gangRosterOwn: "gang.roster.manage.own",
  gangRosterAny: "gang.roster.manage.any",
  playerRead: "player.read",
  playerCreate: "player.create",
  playerUpdate: "player.update",
  playerArchive: "player.archive",
  playerDelete: "player.delete",
  tournamentRead: "tournament.read",
  tournamentCreate: "tournament.create",
  tournamentUpdate: "tournament.update",
  tournamentArchive: "tournament.archive",
  tournamentDelete: "tournament.delete",
  bracketManage: "tournament.bracket.manage",
  matchCreate: "match.create",
  matchUpdate: "match.update",
  matchFinalize: "match.finalize",
  matchReopen: "match.reopen",
  rankingConfigure: "ranking.configure",
  seasonManage: "season.manage",
  mediaUpload: "media.upload",
  mediaModerate: "media.moderate",
  mediaDelete: "media.delete",
  userManage: "user.manage",
  roleManage: "role.manage",
  auditRead: "audit.read",
  auditConfigure: "audit.configure",
  settingsManage: "settings.manage",
  eventManage: "event.manage",
  streamManage: "stream.manage",
  systemHealthRead: "system.health.read",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

export const recordStatuses = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "ARCHIVED",
] as const;
export const recruitmentStatuses = ["OPEN", "CLOSED", "INVITE_ONLY"] as const;
export const tournamentStatuses = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
] as const;
export const tournamentFormats = [
  "SINGLE_ELIMINATION",
  "DOUBLE_ELIMINATION",
  "ROUND_ROBIN",
  "GROUP_KNOCKOUT",
  "CUSTOM",
] as const;
export const participantStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "ELIMINATED",
  "CHAMPION",
] as const;
export const matchStatuses = [
  "SCHEDULED",
  "CHECK_IN_OPEN",
  "READY",
  "LIVE",
  "AWAITING_RESULT",
  "DISPUTED",
  "COMPLETED",
  "CANCELLED",
  "FORFEIT",
] as const;
export const eventStatuses = [
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
] as const;
export const streamStatuses = [
  "SCHEDULED",
  "LIVE",
  "OFFLINE",
  "ARCHIVED",
] as const;
export const streamPlatforms = ["TWITCH", "YOUTUBE", "KICK", "OTHER"] as const;
export const mediaStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
  "DELETED",
] as const;
export const seasonStatuses = [
  "DRAFT",
  "ACTIVE",
  "CLOSED",
  "ARCHIVED",
] as const;
export const rankingEntityTypes = ["GANG", "PLAYER"] as const;

export type RecordStatus = (typeof recordStatuses)[number];
export type RecruitmentStatus = (typeof recruitmentStatuses)[number];
export type TournamentStatus = (typeof tournamentStatuses)[number];
export type TournamentFormat = (typeof tournamentFormats)[number];
export type ParticipantStatus = (typeof participantStatuses)[number];
export type MatchStatus = (typeof matchStatuses)[number];
export type EventStatus = (typeof eventStatuses)[number];
export type StreamStatus = (typeof streamStatuses)[number];
export type StreamPlatform = (typeof streamPlatforms)[number];
export type MediaStatus = (typeof mediaStatuses)[number];
export type SeasonStatus = (typeof seasonStatuses)[number];
export type RankingEntityType = (typeof rankingEntityTypes)[number];

export const idSchema = z.string().min(20).max(40);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const gangListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(80).optional(),
  status: z.enum(recordStatuses).optional(),
  recruitment: z.enum(recruitmentStatuses).optional(),
  sort: z
    .enum(["rank", "wins", "kills", "winRate", "name", "newest"])
    .default("rank"),
});

export const matchResultSchema = z
  .object({
    version: z.number().int().min(0),
    gangAScore: z.number().int().min(0).max(99),
    gangBScore: z.number().int().min(0).max(99),
    winnerGangId: idSchema,
    resultNotes: z.string().trim().max(4_000).optional(),
    playerStats: z
      .array(
        z.object({
          playerId: idSchema,
          gangId: idSchema,
          kills: z.number().int().min(0).max(999),
          deaths: z.number().int().min(0).max(999),
          assists: z.number().int().min(0).max(999),
          score: z.number().int().min(0).max(1_000_000).default(0),
          roundsPlayed: z.number().int().min(0).max(99),
          mvp: z.boolean().default(false),
          played: z.boolean().default(true),
          notes: z.string().trim().max(2_000).optional(),
        }),
      )
      .max(128),
  })
  .superRefine((value, context) => {
    const playerIds = new Set(value.playerStats.map((item) => item.playerId));
    if (playerIds.size !== value.playerStats.length) {
      context.addIssue({
        code: "custom",
        path: ["playerStats"],
        message: "A player can appear only once in a match result.",
      });
    }
    if (value.playerStats.filter((item) => item.mvp).length > 1) {
      context.addIssue({
        code: "custom",
        path: ["playerStats"],
        message: "Only one player can be selected as match MVP.",
      });
    }
  });

const optionalHttpsUrl = z
  .union([
    z.literal(""),
    z.url().refine((value) => value.startsWith("https://"), "Must use HTTPS."),
  ])
  .optional();

export const websiteSettingsSchema = z.object({
  general: z.object({
    websiteName: z.string().trim().min(2).max(80),
    shortName: z.string().trim().min(1).max(20),
    description: z.string().trim().max(500),
    logoUrl: optionalHttpsUrl,
    faviconUrl: optionalHttpsUrl,
    defaultLanguage: z.string().trim().min(2).max(12),
    timeZone: z.string().trim().min(2).max(80),
    maintenanceMode: z.boolean(),
  }),
  homepage: z.object({
    heroTitle: z.string().trim().min(1).max(120),
    heroSubtitle: z.string().trim().max(240),
    heroMediaUrl: optionalHttpsUrl,
    announcement: z.string().trim().max(240),
  }),
  pages: z
    .object({
      rulesTitle: z.string().trim().min(1).max(120),
      rulesIntro: z.string().trim().max(500),
      rulesContent: z.string().trim().max(20_000),
      aboutTitle: z.string().trim().min(1).max(120),
      aboutIntro: z.string().trim().max(500),
      aboutContent: z.string().trim().max(20_000),
    })
    .optional(),
  tournament: z.object({
    defaultBestOf: z.number().int().min(1).max(99),
    defaultParticipantCapacity: z.number().int().min(2).max(256),
    registrationRules: z.string().trim().max(4_000),
    checkInDurationMinutes: z.number().int().min(0).max(1_440),
    resultSubmissionMinutes: z.number().int().min(0).max(10_080),
  }),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    backgroundMediaUrl: optionalHttpsUrl,
    animationIntensity: z.enum(["NONE", "REDUCED", "NORMAL"]),
  }),
  social: z.record(z.string(), optionalHttpsUrl),
});

export type WebsiteSettings = z.infer<typeof websiteSettingsSchema>;

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
  previousRank: number | null;
  peakRank: number | null;
  memberCount: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  winRate: number;
  trophies: number;
  points: number;
  streak: number;
  killDifference: number;
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
  providerChannelId: string | null;
  liveVideoId: string | null;
  status: string;
  autoDetect: boolean;
  lastCheckedAt: string | null;
  lastStatusError: string | null;
  featured: boolean;
  startsAt: string | null;
  tournament: { id: string; slug: string; name: string } | null;
}
