import type {
  ApiEnvelope,
  GangListItem,
  HomeSummary,
  PublicEvent,
  PublicLiveStream,
} from "@mafia/shared";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4177";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "API_ERROR",
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has("content-type")) {
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
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.error?.message ?? "The registry could not be reached.",
      body?.error?.code,
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
    totalPlayers: number;
    activeTournaments: number;
    upcomingMatches: number;
    awaitingResults: number;
    disputedMatches: number;
    pendingMedia: number;
  };
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    actor: { displayName: string } | null;
  }>;
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
  roles?: Array<{ role: { name: string } }>;
}

export interface AuditRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
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
  matches: () => apiRequest<ApiEnvelope<unknown[]>>("/api/v1/matches"),
  events: () => apiRequest<ApiEnvelope<PublicEvent[]>>("/api/v1/events"),
  liveStreams: () =>
    apiRequest<ApiEnvelope<PublicLiveStream[]>>("/api/v1/live-streams"),
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
    seed: number,
  ) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(participantId)}`,
      { method: "PATCH", body: JSON.stringify({ seed }) },
    ),
  removeTournamentParticipant: (tournamentId: string, participantId: string) =>
    apiRequest<unknown>(
      `/api/v1/admin/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(participantId)}`,
      { method: "DELETE" },
    ),
  generateBracket: (tournamentId: string) =>
    apiRequest<
      ApiEnvelope<{
        bracketVersion: number;
        slotCount: number;
        roundCount: number;
      }>
    >(
      `/api/v1/admin/tournaments/${encodeURIComponent(tournamentId)}/bracket/generate`,
      { method: "POST" },
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
  auditLogs: () =>
    apiRequest<ApiEnvelope<AuditRecord[]>>("/api/v1/admin/audit-logs"),
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
};
