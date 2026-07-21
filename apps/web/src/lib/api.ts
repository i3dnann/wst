import type {
  ApiEnvelope,
  GangListItem,
  HomeSummary,
  PublicEvent,
  PublicLiveStream,
  WebsiteSettings,
} from "@mafia/shared";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:4177" : "/backend");

let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "API_ERROR",
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  retryAfterRefresh = true,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init.body !== null;

  if (!headers.has("content-type") && hasBody && !isFormData) {
    headers.set("content-type", "application/json");
  }
  if (init?.method && !["GET", "HEAD"].includes(init.method.toUpperCase())) {
    const csrf = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("wst_csrf="))
      ?.split("=")[1];
    if (csrf) headers.set("x-csrf-token", decodeURIComponent(csrf));
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const body = (await response.json().catch(() => null)) as {
    error?: {
      code?: string;
      message?: string;
      requestId?: string;
      details?: unknown;
    };
  } | null;
  if (
    response.status === 401 &&
    retryAfterRefresh &&
    !path.endsWith("/auth/login") &&
    !path.endsWith("/auth/refresh")
  ) {
    refreshPromise ??= fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((refresh) => refresh.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
    if (await refreshPromise) return apiRequest<T>(path, init, false);
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.error?.message ?? "The registry could not be reached.",
      body?.error?.code,
      body?.error?.requestId,
      body?.error?.details,
    );
  if (response.status === 204 || response.status === 205) return undefined as T;
  if (body === null)
    throw new ApiError(
      response.status,
      "The registry returned an invalid response.",
      "INVALID_API_RESPONSE",
    );
  return body as T;
}

export interface HomeData {
  summary: HomeSummary;
  featuredGangs: GangListItem[];
  rankings: GangListItem[];
  recentMatches: unknown[];
  currentMvp: unknown;
}

export interface AdminOverviewData {
  summary: {
    totalGangs: number;
    activeGangs: number;
    archivedGangs: number;
    totalPlayers: number;
    activePlayers: number;
    totalTournaments: number;
    draftTournaments: number;
    registrationOpenTournaments: number;
    activeTournaments: number;
    completedTournaments: number;
    upcomingMatches: number;
    liveMatches: number;
    awaitingResults: number;
    disputedMatches: number;
    upcomingEvents: number;
    liveStreams: number;
    pendingMedia: number;
    administrators: number;
  };
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    actor: { displayName: string } | null;
  }>;
  attention: {
    nextMatches: Array<{
      id: string;
      scheduledAt: string | null;
      gangA: { name: string; tag: string } | null;
      gangB: { name: string; tag: string } | null;
      tournament: { name: string; slug: string } | null;
    }>;
    unseededParticipants: number;
    streamsWithErrors: Array<{
      id: string;
      streamerName: string;
      platform: string;
      lastCheckedAt: string | null;
      lastStatusError: string | null;
    }>;
  };
}

export interface AdminUser {
  id: string;
  email: string | null;
  displayName: string;
  permissions: string[];
}

export interface AdministratorRecord {
  id: string;
  email: string | null;
  displayName: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles?: Array<{ role: { id: string; name: string } }>;
}

export interface AuditRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  beforeData: unknown;
  afterData: unknown;
  reason: string | null;
  actor: { id: string; displayName: string } | null;
}

export interface DiscordAuditSettings {
  enabled: boolean;
  configured: boolean;
  maskedWebhookUrl: string | null;
  categories: string[];
}

export const api = {
  home: () => apiRequest<ApiEnvelope<HomeData>>("/api/v1/public/home"),
  publicSettings: () =>
    apiRequest<
      ApiEnvelope<{ value: WebsiteSettings | null; updatedAt: string | null }>
    >("/api/v1/public/settings"),
  gangs: (query = "") =>
    apiRequest<ApiEnvelope<GangListItem[]>>(
      `/api/v1/gangs${query ? `?${query}` : ""}`,
    ),
  gang: (slug: string) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/gangs/${encodeURIComponent(slug)}`,
    ),
  players: () => apiRequest<ApiEnvelope<unknown[]>>("/api/v1/players"),
  player: (slug: string) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/players/${encodeURIComponent(slug)}`,
    ),
  tournaments: () => apiRequest<ApiEnvelope<unknown[]>>("/api/v1/tournaments"),
  tournament: (slug: string) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/tournaments/${encodeURIComponent(slug)}`,
    ),
  bracket: (slug: string) =>
    apiRequest<ApiEnvelope<{ version: number; rounds: unknown[] }>>(
      `/api/v1/tournaments/${encodeURIComponent(slug)}/bracket`,
    ),
  rankings: () =>
    apiRequest<ApiEnvelope<GangListItem[]>>("/api/v1/rankings/gangs"),
  playerRankings: () =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      "/api/v1/rankings/players",
    ),
  matches: () => apiRequest<ApiEnvelope<unknown[]>>("/api/v1/matches"),
  events: () => apiRequest<ApiEnvelope<PublicEvent[]>>("/api/v1/events"),
  liveStreams: () =>
    apiRequest<ApiEnvelope<PublicLiveStream[]>>("/api/v1/live-streams"),
  publicSeasons: () =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>("/api/v1/seasons"),
  match: (id: string) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/matches/${encodeURIComponent(id)}`,
    ),
  adminOverview: () =>
    apiRequest<ApiEnvelope<AdminOverviewData>>("/api/v1/admin/overview"),
  adminLogin: (email: string, password: string) =>
    apiRequest<ApiEnvelope<Pick<AdminUser, "id" | "email" | "displayName">>>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),
  adminMe: () => apiRequest<ApiEnvelope<AdminUser>>("/api/v1/auth/me"),
  adminLogout: () =>
    apiRequest<unknown>("/api/v1/auth/logout", { method: "POST" }),
  adminGangs: () =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      "/api/v1/admin/gangs",
    ),
  adminPlayers: () =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      "/api/v1/admin/players",
    ),
  adminTournaments: () =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      "/api/v1/admin/tournaments",
    ),
  adminTournament: (id: string) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/tournaments/${encodeURIComponent(id)}`,
    ),
  adminMatches: () =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      "/api/v1/admin/matches",
    ),
  adminEvents: () =>
    apiRequest<ApiEnvelope<PublicEvent[]>>("/api/v1/admin/events"),
  adminLiveStreams: () =>
    apiRequest<ApiEnvelope<PublicLiveStream[]>>("/api/v1/admin/live-streams"),
  createGang: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>("/api/v1/admin/gangs", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateGang: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/gangs/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  archiveGang: (id: string) =>
    apiRequest<unknown>(`/api/v1/admin/gangs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  createPlayer: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>("/api/v1/admin/players", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePlayer: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/players/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  archivePlayer: (id: string) =>
    apiRequest<unknown>(`/api/v1/admin/players/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  createTournament: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      "/api/v1/admin/tournaments",
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateTournament: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/tournaments/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  archiveTournament: (id: string) =>
    apiRequest<unknown>(`/api/v1/admin/tournaments/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  createMatch: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>("/api/v1/admin/matches", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateMatch: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/matches/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  deleteMatch: (id: string) =>
    apiRequest<unknown>(`/api/v1/admin/matches/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  addTournamentParticipant: (
    tournamentId: string,
    input: { gangId: string; seed?: number },
  ) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/tournaments/${encodeURIComponent(tournamentId)}/participants`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateTournamentParticipant: (
    tournamentId: string,
    participantId: string,
    input: { seed?: number; status?: string },
  ) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(participantId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  removeTournamentParticipant: (tournamentId: string, participantId: string) =>
    apiRequest<unknown>(
      `/api/v1/admin/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(participantId)}`,
      { method: "DELETE" },
    ),
  generateBracket: (
    tournamentId: string,
    input: {
      confirmReset?: boolean;
      confirmationName?: string;
      placement?: "SEEDED" | "RANDOM";
    } = {},
  ) =>
    apiRequest<
      ApiEnvelope<{
        bracketVersion: number;
        slotCount: number;
        roundCount: number;
      }>
    >(
      `/api/v1/admin/tournaments/${encodeURIComponent(tournamentId)}/bracket/generate`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  advanceMatch: (
    matchId: string,
    input: {
      winnerGangId: string;
      gangAScore: number;
      gangBScore: number;
      version: number;
    },
  ) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/matches/${encodeURIComponent(matchId)}/advance`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  createEvent: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<PublicEvent>>("/api/v1/admin/events", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateEvent: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<PublicEvent>>(
      `/api/v1/admin/events/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  archiveEvent: (id: string) =>
    apiRequest<unknown>(`/api/v1/admin/events/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  createLiveStream: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<PublicLiveStream>>("/api/v1/admin/live-streams", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateLiveStream: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<PublicLiveStream>>(
      `/api/v1/admin/live-streams/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  archiveLiveStream: (id: string) =>
    apiRequest<unknown>(
      `/api/v1/admin/live-streams/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    ),
  refreshLiveStream: (id: string) =>
    apiRequest<ApiEnvelope<PublicLiveStream>>(
      `/api/v1/admin/live-streams/${encodeURIComponent(id)}/refresh`,
      { method: "POST" },
    ),
  refreshAllLiveStreams: () =>
    apiRequest<ApiEnvelope<PublicLiveStream[]>>(
      "/api/v1/admin/live-streams/refresh",
      { method: "POST" },
    ),
  administrators: () =>
    apiRequest<ApiEnvelope<AdministratorRecord[]>>(
      "/api/v1/admin/administrators",
    ),
  createAdministrator: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<AdministratorRecord>>(
      "/api/v1/admin/administrators",
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateAdministrator: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<AdministratorRecord>>(
      `/api/v1/admin/administrators/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  removeAdministrator: (id: string) =>
    apiRequest<unknown>(
      `/api/v1/admin/administrators/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
  auditLogs: (query = "") =>
    apiRequest<ApiEnvelope<AuditRecord[]>>(
      `/api/v1/admin/audit-logs${query ? `?${query}` : ""}`,
    ),
  discordAuditSettings: () =>
    apiRequest<ApiEnvelope<DiscordAuditSettings>>(
      "/api/v1/admin/discord-audit",
    ),
  updateDiscordAuditSettings: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<DiscordAuditSettings>>(
      "/api/v1/admin/discord-audit",
      { method: "PUT", body: JSON.stringify(input) },
    ),
  testDiscordAuditWebhook: (webhookUrl?: string) =>
    apiRequest<ApiEnvelope<{ delivered: boolean }>>(
      "/api/v1/admin/discord-audit/test",
      {
        method: "POST",
        body: JSON.stringify(webhookUrl ? { webhookUrl } : {}),
      },
    ),
  restoreRecord: (
    resource: "gangs" | "players" | "tournaments" | "events" | "live-streams",
    id: string,
  ) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/${resource}/${encodeURIComponent(id)}/restore`,
      { method: "POST" },
    ),
  gangRoles: (gangId: string) =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      `/api/v1/admin/gangs/${encodeURIComponent(gangId)}/roles`,
    ),
  createGangRole: (gangId: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/gangs/${encodeURIComponent(gangId)}/roles`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateGangRole: (
    gangId: string,
    roleId: string,
    input: Record<string, unknown>,
  ) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/gangs/${encodeURIComponent(gangId)}/roles/${encodeURIComponent(roleId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  archiveGangRole: (gangId: string, roleId: string) =>
    apiRequest<unknown>(
      `/api/v1/admin/gangs/${encodeURIComponent(gangId)}/roles/${encodeURIComponent(roleId)}`,
      { method: "DELETE" },
    ),
  gangMemberships: (gangId: string) =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      `/api/v1/admin/gangs/${encodeURIComponent(gangId)}/memberships`,
    ),
  createGangMembership: (gangId: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/gangs/${encodeURIComponent(gangId)}/memberships`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateGangMembership: (
    gangId: string,
    membershipId: string,
    input: Record<string, unknown>,
  ) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/gangs/${encodeURIComponent(gangId)}/memberships/${encodeURIComponent(membershipId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  removeGangMembership: (gangId: string, membershipId: string) =>
    apiRequest<unknown>(
      `/api/v1/admin/gangs/${encodeURIComponent(gangId)}/memberships/${encodeURIComponent(membershipId)}`,
      { method: "DELETE" },
    ),
  seasons: () =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      "/api/v1/admin/seasons",
    ),
  createSeason: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>("/api/v1/admin/seasons", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSeason: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/seasons/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  recalculateSeason: (id: string) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/seasons/${encodeURIComponent(id)}/recalculate`,
      { method: "POST" },
    ),
  roles: () =>
    apiRequest<
      ApiEnvelope<{
        roles: Array<Record<string, unknown>>;
        permissions: Array<Record<string, unknown>>;
      }>
    >("/api/v1/admin/roles"),
  createRole: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>("/api/v1/admin/roles", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateRole: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/roles/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  updateRolePermissions: (id: string, permissionIds: string[]) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/roles/${encodeURIComponent(id)}/permissions`,
      { method: "PUT", body: JSON.stringify({ permissionIds }) },
    ),
  updateAdministratorRoles: (id: string, roleIds: string[]) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/administrators/${encodeURIComponent(id)}/roles`,
      { method: "PUT", body: JSON.stringify({ roleIds }) },
    ),
  revokeAdministratorSessions: (id: string) =>
    apiRequest<unknown>(
      `/api/v1/admin/administrators/${encodeURIComponent(id)}/sessions`,
      { method: "DELETE" },
    ),
  websiteSettings: () =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      "/api/v1/admin/website-settings",
    ),
  updateWebsiteSettings: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      "/api/v1/admin/website-settings",
      { method: "PUT", body: JSON.stringify(input) },
    ),
  media: () =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      "/api/v1/admin/media",
    ),
  mediaUploadIntent: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      "/api/v1/media/upload-intent",
      { method: "POST", body: JSON.stringify(input) },
    ),
  completeMediaUpload: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      "/api/v1/admin/media/complete",
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateMedia: (id: string, status: string) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/media/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ),
  deleteMedia: (id: string) =>
    apiRequest<unknown>(`/api/v1/admin/media/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  systemHealth: () =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      "/api/v1/admin/system-health",
    ),
  matchDownstreamImpact: (id: string) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/matches/${encodeURIComponent(id)}/downstream-impact`,
    ),
  disputeAssignees: () =>
    apiRequest<ApiEnvelope<Array<Record<string, unknown>>>>(
      "/api/v1/admin/dispute-assignees",
    ),
  reopenMatch: (id: string, input: { version: number; reason: string }) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/matches/${encodeURIComponent(id)}/reopen`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  disputeMatch: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/matches/${encodeURIComponent(id)}/dispute`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  resolveMatchDispute: (id: string, resolution: string) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/matches/${encodeURIComponent(id)}/dispute/resolve`,
      { method: "POST", body: JSON.stringify({ resolution }) },
    ),
  finalizeMatch: (id: string, input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/matches/${encodeURIComponent(id)}/finalize`,
      { method: "POST", body: JSON.stringify(input) },
    ),
};
