import { cleanup, render, screen } from "@testing-library/react";
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
  });
});
