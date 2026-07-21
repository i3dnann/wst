import type { LiveStream, StreamPlatform } from "@prisma/client";
import { env } from "./env.js";
import { prisma } from "./prisma.js";

interface DetectionResult {
  live: boolean;
  embedUrl?: string | undefined;
  thumbnailUrl?: string | undefined;
  liveVideoId?: string | undefined;
  viewerCount?: number | undefined;
  streamTitle?: string | undefined;
  categoryName?: string | undefined;
  liveStartedAt?: Date | null | undefined;
}

interface TwitchToken {
  value: string;
  expiresAt: number;
}

let twitchToken: TwitchToken | null = null;
let kickToken: TwitchToken | null = null;
let refreshPromise: Promise<void> | null = null;

export function channelIdentifier(stream: LiveStream): string {
  if (stream.providerChannelId?.trim()) return stream.providerChannelId.trim();
  try {
    const url = new URL(stream.channelUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (stream.platform === "YOUTUBE" && parts[0] === "channel" && parts[1])
      return parts[1];
    return parts[0] ?? "";
  } catch {
    return "";
  }
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok)
    throw new Error(`Provider returned HTTP ${String(response.status)}.`);
  return (await response.json()) as T;
}

async function getTwitchToken(): Promise<string> {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET)
    throw new Error("Twitch credentials are not configured.");
  if (twitchToken && twitchToken.expiresAt > Date.now() + 60_000)
    return twitchToken.value;
  const query = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  const token = await readJson<{ access_token: string; expires_in: number }>(
    `https://id.twitch.tv/oauth2/token?${query.toString()}`,
    { method: "POST" },
  );
  twitchToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1_000,
  };
  return twitchToken.value;
}

async function getKickToken(): Promise<string> {
  if (!env.KICK_CLIENT_ID || !env.KICK_CLIENT_SECRET)
    throw new Error("Kick credentials are not configured.");
  if (kickToken && kickToken.expiresAt > Date.now() + 60_000)
    return kickToken.value;
  const body = new URLSearchParams({
    client_id: env.KICK_CLIENT_ID,
    client_secret: env.KICK_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  const token = await readJson<{ access_token: string; expires_in: number }>(
    "https://id.kick.com/oauth/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  kickToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1_000,
  };
  return kickToken.value;
}

function providerDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

async function detectTwitch(stream: LiveStream): Promise<DetectionResult> {
  const login = channelIdentifier(stream).toLowerCase();
  if (!login) throw new Error("Add the Twitch channel username.");
  const token = await getTwitchToken();
  const query = new URLSearchParams({ user_login: login });
  const result = await readJson<{
    data: Array<{
      thumbnail_url?: string;
      viewer_count?: number;
      title?: string;
      game_name?: string;
      started_at?: string;
    }>;
  }>(`https://api.twitch.tv/helix/streams?${query.toString()}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "client-id": env.TWITCH_CLIENT_ID ?? "",
    },
  });
  const active = result.data[0];
  return {
    live: Boolean(active),
    embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(login)}`,
    thumbnailUrl: active?.thumbnail_url
      ?.replace("{width}", "1280")
      .replace("{height}", "720"),
    viewerCount: active?.viewer_count ?? 0,
    streamTitle: active?.title,
    categoryName: active?.game_name,
    liveStartedAt: providerDate(active?.started_at),
  };
}

async function detectYouTube(stream: LiveStream): Promise<DetectionResult> {
  if (!env.YOUTUBE_API_KEY)
    throw new Error("YouTube API key is not configured.");
  const channelId = channelIdentifier(stream);
  if (!channelId)
    throw new Error(
      "Add the YouTube channel ID (the value beginning with UC).",
    );
  const query = new URLSearchParams({
    part: "snippet",
    channelId,
    eventType: "live",
    type: "video",
    maxResults: "1",
    key: env.YOUTUBE_API_KEY,
  });
  const result = await readJson<{
    items: Array<{
      id?: { videoId?: string };
      snippet?: { thumbnails?: { high?: { url?: string } } };
    }>;
  }>(`https://www.googleapis.com/youtube/v3/search?${query.toString()}`);
  const item = result.items[0];
  const videoId = item?.id?.videoId;
  return {
    live: Boolean(videoId),
    liveVideoId: videoId,
    embedUrl: videoId
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`
      : undefined,
    thumbnailUrl: item?.snippet?.thumbnails?.high?.url,
  };
}

export async function detectKick(stream: LiveStream): Promise<DetectionResult> {
  const slug = channelIdentifier(stream).toLowerCase();
  if (!slug) throw new Error("Add the Kick channel username.");
  const token = await getKickToken();
  const query = new URLSearchParams();
  query.append("slug", slug);
  const result = await readJson<{
    data: Array<{
      slug: string;
      stream_title?: string;
      category?: { name?: string } | null;
      stream?: {
        is_live?: boolean;
        thumbnail?: string;
        viewer_count?: number;
        start_time?: string;
      } | null;
    }>;
  }>(`https://api.kick.com/public/v1/channels?${query.toString()}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const channel = result.data.find(
    (candidate) => candidate.slug.toLowerCase() === slug,
  );
  if (!channel) throw new Error(`Kick channel "${slug}" was not found.`);
  const live = channel.stream?.is_live === true;
  return {
    live,
    embedUrl: `https://player.kick.com/${encodeURIComponent(slug)}`,
    thumbnailUrl: channel.stream?.thumbnail,
    viewerCount: live ? Math.max(0, channel.stream?.viewer_count ?? 0) : 0,
    streamTitle: channel.stream_title,
    categoryName: channel.category?.name,
    liveStartedAt: live ? providerDate(channel.stream?.start_time) : null,
  };
}

async function detect(stream: LiveStream): Promise<DetectionResult> {
  const detectors: Partial<
    Record<StreamPlatform, (value: LiveStream) => Promise<DetectionResult>>
  > = {
    TWITCH: detectTwitch,
    YOUTUBE: detectYouTube,
    KICK: detectKick,
  };
  const detector = detectors[stream.platform];
  if (!detector)
    throw new Error("Automatic detection is unavailable for this platform.");
  return detector(stream);
}

export async function refreshStreamStatus(
  streamId: string,
): Promise<LiveStream> {
  const stream = await prisma.liveStream.findUniqueOrThrow({
    where: { id: streamId },
  });
  if (!stream.autoDetect || stream.status === "ARCHIVED") return stream;
  try {
    const result = await detect(stream);
    return await prisma.liveStream.update({
      where: { id: stream.id },
      data: {
        status: result.live ? "LIVE" : "OFFLINE",
        embedUrl: result.embedUrl ?? stream.embedUrl,
        thumbnailUrl: result.thumbnailUrl ?? stream.thumbnailUrl,
        liveVideoId: result.liveVideoId ?? null,
        viewerCount: result.viewerCount ?? stream.viewerCount,
        streamTitle: result.streamTitle ?? stream.streamTitle,
        categoryName: result.categoryName ?? stream.categoryName,
        liveStartedAt:
          result.liveStartedAt === undefined
            ? stream.liveStartedAt
            : result.liveStartedAt,
        lastCheckedAt: new Date(),
        lastStatusError: null,
      },
    });
  } catch (error) {
    return prisma.liveStream.update({
      where: { id: stream.id },
      data: {
        lastCheckedAt: new Date(),
        lastStatusError:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Check failed.",
      },
    });
  }
}

export async function refreshStaleStreams(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const streams = await prisma.liveStream.findMany({
      where: {
        autoDetect: true,
        status: { not: "ARCHIVED" },
      },
      select: { id: true, platform: true, lastCheckedAt: true },
      take: 100,
    });
    const now = Date.now();
    const stale = streams.filter((stream) => {
      const ttl =
        stream.platform === "YOUTUBE"
          ? env.YOUTUBE_STATUS_TTL_SECONDS
          : env.STREAM_STATUS_TTL_SECONDS;
      return (
        !stream.lastCheckedAt ||
        stream.lastCheckedAt.getTime() <= now - ttl * 1_000
      );
    });
    await Promise.allSettled(
      stale.map((stream) => refreshStreamStatus(stream.id)),
    );
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
