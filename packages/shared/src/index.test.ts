import { describe, expect, it } from "vitest";
import {
  gangListQuerySchema,
  matchResultSchema,
  websiteSettingsSchema,
} from "./index.js";

describe("shared API contracts", () => {
  it("normalizes public pagination safely", () => {
    expect(
      gangListQuerySchema.parse({ page: "2", pageSize: "25" }),
    ).toMatchObject({ page: 2, pageSize: 25, sort: "rank" });
  });

  it("rejects an invalid match result before it reaches the service", () => {
    expect(
      matchResultSchema.safeParse({
        version: 0,
        gangAScore: -1,
        gangBScore: 0,
        winnerGangId: "bad",
        playerStats: [],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate players and multiple MVP awards", () => {
    const playerId = "player_identifier_1234567890";
    const gangId = "gang_identifier_123456789012";
    const result = matchResultSchema.safeParse({
      version: 1,
      gangAScore: 2,
      gangBScore: 0,
      winnerGangId: gangId,
      playerStats: [
        {
          playerId,
          gangId,
          kills: 2,
          deaths: 0,
          assists: 1,
          roundsPlayed: 2,
          mvp: true,
        },
        {
          playerId,
          gangId,
          kills: 1,
          deaths: 1,
          assists: 0,
          roundsPlayed: 2,
          mvp: true,
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "A player can appear only once in a match result.",
          "Only one player can be selected as match MVP.",
        ]),
      );
    }
  });

  it("validates typed website settings and HTTPS media", () => {
    const result = websiteSettingsSchema.safeParse({
      general: {
        websiteName: "World Star",
        shortName: "WST",
        description: "Registry",
        logoUrl: "http://unsafe.test/logo.png",
        faviconUrl: "",
        defaultLanguage: "en",
        timeZone: "Europe/Berlin",
        maintenanceMode: false,
      },
      homepage: {
        heroTitle: "World Star",
        heroSubtitle: "Loyalty",
        heroMediaUrl: "",
        announcement: "",
      },
      tournament: {
        defaultBestOf: 3,
        defaultParticipantCapacity: 16,
        registrationRules: "",
        checkInDurationMinutes: 30,
        resultSubmissionMinutes: 60,
      },
      branding: {
        primaryColor: "#b88a44",
        secondaryColor: "#5b3a20",
        accentColor: "#d3ad68",
        backgroundMediaUrl: "",
        animationIntensity: "NORMAL",
      },
      social: {},
    });
    expect(result.success).toBe(false);
  });
});
