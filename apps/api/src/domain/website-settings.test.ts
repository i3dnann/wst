import { describe, expect, it } from "vitest";
import {
  defaultWebsiteSettings,
  parseWebsiteSettingsInput,
  readWebsiteSettings,
} from "./website-settings.js";

describe("website settings", () => {
  it("restores defaults around older partial settings without losing saved values", () => {
    const settings = readWebsiteSettings({
      general: { websiteName: "World Star CFW" },
      social: { discord: "discord.gg/eZqaNx5P7y" },
    });

    expect(settings.general.websiteName).toBe("World Star CFW");
    expect(settings.general.shortName).toBe(
      defaultWebsiteSettings.general.shortName,
    );
    expect(settings.homepage.heroTitle).toBe(
      defaultWebsiteSettings.homepage.heroTitle,
    );
    expect(settings.social.discord).toBe("https://discord.gg/eZqaNx5P7y");
  });

  it("normalizes common social and media links before saving", () => {
    const settings = parseWebsiteSettingsInput({
      ...defaultWebsiteSettings,
      general: {
        ...defaultWebsiteSettings.general,
        logoUrl: "res.cloudinary.com/demo/image/upload/logo.png",
      },
      social: {
        ...defaultWebsiteSettings.social,
        youtube: " youtube.com/@worldstar ",
      },
    });

    expect(settings.general.logoUrl).toBe(
      "https://res.cloudinary.com/demo/image/upload/logo.png",
    );
    expect(settings.social.youtube).toBe("https://youtube.com/@worldstar");
  });

  it("still rejects unsafe URL schemes", () => {
    expect(() =>
      parseWebsiteSettingsInput({
        ...defaultWebsiteSettings,
        social: { discord: "javascript:alert(1)" },
      }),
    ).toThrow();
  });
});
