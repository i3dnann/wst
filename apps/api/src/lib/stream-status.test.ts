import type { LiveStream } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { channelIdentifier } from "./stream-status.js";

vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/worldstar_test";
  process.env.FRONTEND_URL = "http://localhost:5173";
  process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
  process.env.SESSION_SECRET =
    "test-session-secret-that-is-at-least-thirty-two-characters";
});

function stream(
  platform: LiveStream["platform"],
  channelUrl: string,
  providerChannelId: string | null = null,
): LiveStream {
  return {
    id: "stream-id",
    slug: "stream",
    streamerName: "Streamer",
    platform,
    channelUrl,
    embedUrl: null,
    thumbnailUrl: null,
    providerChannelId,
    liveVideoId: null,
    status: "OFFLINE",
    autoDetect: true,
    lastCheckedAt: null,
    lastStatusError: null,
    featured: false,
    tournamentId: null,
    startsAt: null,
    createdByUserId: "user-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };
}

describe("stream provider channel identifiers", () => {
  it("prefers the configured provider identifier", () => {
    expect(
      channelIdentifier(
        stream("TWITCH", "https://twitch.tv/old-name", "new-name"),
      ),
    ).toBe("new-name");
  });

  it("extracts Twitch and Kick usernames from channel URLs", () => {
    expect(
      channelIdentifier(stream("TWITCH", "https://twitch.tv/worldstar")),
    ).toBe("worldstar");
    expect(
      channelIdentifier(stream("KICK", "https://kick.com/worldstar-live")),
    ).toBe("worldstar-live");
  });

  it("extracts a YouTube channel ID", () => {
    expect(
      channelIdentifier(
        stream("YOUTUBE", "https://youtube.com/channel/UC123456"),
      ),
    ).toBe("UC123456");
  });
});
