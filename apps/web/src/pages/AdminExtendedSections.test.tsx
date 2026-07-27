import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  SeasonsManager,
  WebsiteSettingsManager,
} from "./AdminExtendedSections";

vi.mock("@/lib/api", () => ({
  api: {
    websiteSettings: vi.fn(),
    updateWebsiteSettings: vi.fn(),
    seasons: vi.fn(),
    createSeason: vi.fn(),
    updateSeason: vi.fn(),
    recalculateSeason: vi.fn(),
  },
  ApiError: class extends Error {},
}));

const websiteSettings = vi.mocked(api.websiteSettings);
const updateWebsiteSettings = vi.mocked(api.updateWebsiteSettings);
const seasons = vi.mocked(api.seasons);
const updateSeason = vi.mocked(api.updateSeason);

const savedSettings = {
  general: {
    websiteName: "World Star Registry",
    shortName: "WST",
    description: "Official registry",
    logoUrl: "",
    faviconUrl: "",
    defaultLanguage: "en",
    timeZone: "Europe/Berlin",
    maintenanceMode: false,
  },
  homepage: {
    heroTitle: "WORLD STAR CFW",
    heroSubtitle: "Official competition",
    heroMediaUrl: "",
    announcement: "",
  },
  pages: {
    rulesTitle: "Rules",
    rulesIntro: "",
    rulesContent: "",
    aboutTitle: "About",
    aboutIntro: "",
    aboutContent: "",
  },
  tournament: {
    defaultBestOf: 1,
    defaultParticipantCapacity: 16,
    registrationRules: "",
    checkInDurationMinutes: 30,
    resultSubmissionMinutes: 60,
  },
  branding: {
    primaryColor: "#c51f38",
    secondaryColor: "#6f0d1c",
    accentColor: "#ef4058",
    backgroundMediaUrl: "",
    animationIntensity: "NORMAL",
  },
  pageLocks: {
    home: false,
    gangs: false,
    players: false,
    tournaments: false,
    matches: false,
    rankings: false,
    events: false,
    live: false,
    rules: false,
    about: false,
  },
  social: {
    discord: "",
    youtube: "",
    twitch: "",
    kick: "",
    tiktok: "",
    twitter: "",
    instagram: "",
  },
};

describe("WebsiteSettingsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    websiteSettings.mockResolvedValue({
      data: savedSettings,
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    updateWebsiteSettings.mockImplementation((input) =>
      Promise.resolve({
        data: input,
        meta: { requestId: "test", timestamp: new Date().toISOString() },
      }),
    );
  });
  afterEach(cleanup);

  it("saves social links together with the other website settings", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <WebsiteSettingsManager />
      </QueryClientProvider>,
    );

    await screen.findByDisplayValue("Official registry");
    const discord = screen.getByLabelText("Discord");
    fireEvent.change(discord, {
      target: { value: "discord.gg/eZqaNx5P7y" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "Lock Gangs page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => expect(updateWebsiteSettings).toHaveBeenCalledOnce());
    const payload = updateWebsiteSettings.mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    const general = payload?.general as Record<string, unknown>;
    const pageLocks = payload?.pageLocks as Record<string, unknown>;
    const social = payload?.social as Record<string, unknown>;
    expect(general.websiteName).toBe("World Star Registry");
    expect(pageLocks.gangs).toBe(true);
    expect(social.discord).toBe("discord.gg/eZqaNx5P7y");
  });
});

describe("SeasonsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seasons.mockResolvedValue({
      data: [
        {
          id: "season-world-star-2026",
          name: "World Star",
          slug: "world-star",
          status: "DRAFT",
          startsAt: "2026-07-22T00:00:00.000Z",
          _count: { tournaments: 0, gangStats: 0, playerStats: 0 },
        },
      ],
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
    updateSeason.mockResolvedValue({
      data: { id: "season-world-star-2026", status: "ACTIVE" },
      meta: { requestId: "test", timestamp: new Date().toISOString() },
    });
  });
  afterEach(cleanup);

  it("updates status and keeps both season actions readable", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <SeasonsManager />
      </QueryClientProvider>,
    );

    const status = await screen.findByDisplayValue("DRAFT");
    const recalculate = screen.getByRole("button", { name: /recalculate/i });
    expect(status.closest(".season-row-actions")).toContainElement(recalculate);
    expect(status.closest("td")).toHaveClass("season-actions-cell");

    fireEvent.change(status, { target: { value: "ACTIVE" } });

    await waitFor(() =>
      expect(updateSeason).toHaveBeenCalledWith("season-world-star-2026", {
        status: "ACTIVE",
      }),
    );
  });
});
