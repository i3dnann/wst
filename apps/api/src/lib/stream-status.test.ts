import type { LiveStream } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { channelIdentifier, detectKick } from "./stream-status.js";

vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/worldstar_test";
  process.env.FRONTEND_URL = "http://localhost:5173";
  process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
  process.env.KICK_CLIENT_ID = "test-kick-client";
  process.env.KICK_CLIENT_SECRET = "test-kick-secret";
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
    viewerCount: 0,
    streamTitle: null,
    categoryName: null,
    liveStartedAt: null,
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("uses the official Kick app token and channel endpoint", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "kick-app-token",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                slug: "worldstar-live",
                stream_title: "World Star tournament night",
                category: { name: "Grand Theft Auto V" },
                stream: {
                  is_live: true,
                  thumbnail: "https://example.com/live.jpg",
                  viewer_count: 427,
                  start_time: "2026-07-21T18:00:00Z",
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await detectKick(
      stream("KICK", "https://kick.com/worldstar-live"),
    );

    expect(result).toMatchObject({
      live: true,
      viewerCount: 427,
      streamTitle: "World Star tournament night",
      categoryName: "Grand Theft Auto V",
      embedUrl: "https://player.kick.com/worldstar-live",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://id.kick.com/oauth/token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.kick.com/public/v1/channels?slug=worldstar-live",
      expect.objectContaining({
        headers: { authorization: "Bearer kick-app-token" },
      }),
    );
  });
});
