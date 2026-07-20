import type { ApiEnvelope, GangListItem, HomeSummary } from "@mafia/shared";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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
  createGang: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>("/api/v1/admin/gangs", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createPlayer: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>("/api/v1/admin/players", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  createTournament: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>(
      "/api/v1/admin/tournaments",
      { method: "POST", body: JSON.stringify(input) },
    ),
  createMatch: (input: Record<string, unknown>) =>
    apiRequest<ApiEnvelope<Record<string, unknown>>>("/api/v1/admin/matches", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
