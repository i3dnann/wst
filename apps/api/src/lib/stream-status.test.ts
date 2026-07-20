import type { LiveStream } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { channelIdentifier } from "./stream-status.js";

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
