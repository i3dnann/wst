import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebsiteSettings } from "@mafia/shared";
import { usePublicWebsiteSettings } from "@/lib/website-settings";
import { PublicLayout } from "./PublicLayout";

vi.mock("@/lib/website-settings", () => ({
  usePublicWebsiteSettings: vi.fn(),
}));

const publicSettings = vi.mocked(usePublicWebsiteSettings);

const settings = {
  general: {
    websiteName: "World Star CFW",
    shortName: "WST",
    description: "Official World Star registry",
    logoUrl: "",
    faviconUrl: "",
    defaultLanguage: "en",
    timeZone: "Europe/Berlin",
    maintenanceMode: false,
  },
  homepage: {
    heroTitle: "WORLD STAR CFW",
    heroSubtitle: "",
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
    discord: "https://discord.gg/eZqaNx5P7y",
    youtube: "",
  },
} satisfies WebsiteSettings;

describe("PublicLayout website settings", () => {
  beforeEach(() => {
    publicSettings.mockReturnValue({
      data: settings,
    } as unknown as ReturnType<typeof usePublicWebsiteSettings>);
  });
  afterEach(cleanup);

  it("publishes saved description and social links in the footer", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<p>Home content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Official World Star registry"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discord" })).toHaveAttribute(
      "href",
      "https://discord.gg/eZqaNx5P7y",
    );
    expect(
      screen.getByText(/All rights reserved/).closest("small"),
    ).toHaveAttribute("data-disable-scroll-reveal");
  });

  it("replaces a locked section and all its detail routes with Coming Soon", () => {
    publicSettings.mockReturnValue({
      data: {
        ...settings,
        pageLocks: { ...settings.pageLocks, gangs: true },
      },
    } as unknown as ReturnType<typeof usePublicWebsiteSettings>);

    render(
      <MemoryRouter initialEntries={["/gangs/crimson-syndicate"]}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="gangs/:slug" element={<p>Private gang content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Coming Soon" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByText("Gangs"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Primary navigation" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByText("Private gang content")).not.toBeInTheDocument();
  });

  it("keeps public pages available while an older API response has no page locks", () => {
    const legacySettings: Partial<WebsiteSettings> = { ...settings };
    delete legacySettings.pageLocks;
    publicSettings.mockReturnValue({
      data: legacySettings,
    } as unknown as ReturnType<typeof usePublicWebsiteSettings>);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<p>Legacy home content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Legacy home content")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Coming Soon" }),
    ).not.toBeInTheDocument();
  });
});
