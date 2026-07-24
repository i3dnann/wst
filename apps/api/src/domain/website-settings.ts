import { websiteSettingsSchema, type WebsiteSettings } from "@mafia/shared";

export const websiteSettingKey = "website.structured";

export const defaultWebsiteSettings: WebsiteSettings =
  websiteSettingsSchema.parse({
    general: {
      websiteName: "World Star Registry",
      shortName: "WST",
      description: "The official World Star gang and tournament registry.",
      logoUrl: "",
      faviconUrl: "",
      defaultLanguage: "en",
      timeZone: "Europe/Berlin",
      maintenanceMode: false,
    },
    homepage: {
      heroTitle: "WORLD STAR CFW",
      heroSubtitle:
        "Where every rivalry becomes history. Follow verified matches, live tournaments, gang rankings, events, and streams from one official command center.",
      heroMediaUrl: "",
      announcement: "",
    },
    pages: {
      rulesTitle: "Rules of Engagement",
      rulesIntro:
        "Clear competition starts with one shared standard for rosters, evidence, disputes, and verified results.",
      rulesContent:
        "Every participant is responsible for following the published tournament and server rules. Rosters must be accurate before check-in, match evidence must be complete, and disputes must be submitted inside the allowed review window.\n\nAdministrator decisions are recorded through the protected command center so every result remains traceable and consistent.",
      aboutTitle: "Built for the official record",
      aboutIntro:
        "World Star brings gangs, tournaments, rankings, events, streams, and verified match history into one trusted registry.",
      aboutContent:
        "The public website gives every player a clear view of competition while the protected administrator workspace controls publishing, permissions, brackets, results, and platform settings.\n\nEvery surface is connected to the same live records, creating a reliable home for rivalries, achievements, and tournament history.",
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
      discord: "",
      youtube: "",
      twitch: "",
      kick: "",
      tiktok: "",
      twitter: "",
      instagram: "",
    },
  });

type UnknownRecord = Record<string, unknown>;

const urlFields = {
  general: ["logoUrl", "faviconUrl"],
  homepage: ["heroMediaUrl"],
  branding: ["backgroundMediaUrl"],
} as const;

const urlScheme = /^[a-z][a-z\d+.-]*:/i;

function record(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function normalizedUrl(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || urlScheme.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function normalizeUrls(settings: UnknownRecord): UnknownRecord {
  const normalized = { ...settings };
  for (const [sectionName, fields] of Object.entries(urlFields)) {
    const section = { ...record(normalized[sectionName]) };
    for (const field of fields) section[field] = normalizedUrl(section[field]);
    normalized[sectionName] = section;
  }
  normalized.social = Object.fromEntries(
    Object.entries(record(normalized.social)).map(([name, value]) => [
      name,
      normalizedUrl(value),
    ]),
  );
  return normalized;
}

export function parseWebsiteSettingsInput(value: unknown): WebsiteSettings {
  return websiteSettingsSchema.parse(normalizeUrls(record(value)));
}

export function readWebsiteSettings(value: unknown): WebsiteSettings {
  const stored = record(value);
  const candidate = normalizeUrls({
    general: {
      ...defaultWebsiteSettings.general,
      ...record(stored.general),
    },
    homepage: {
      ...defaultWebsiteSettings.homepage,
      ...record(stored.homepage),
    },
    pages: {
      ...(defaultWebsiteSettings.pages ?? {}),
      ...record(stored.pages),
    },
    tournament: {
      ...defaultWebsiteSettings.tournament,
      ...record(stored.tournament),
    },
    branding: {
      ...defaultWebsiteSettings.branding,
      ...record(stored.branding),
    },
    social: {
      ...defaultWebsiteSettings.social,
      ...record(stored.social),
    },
  });
  const parsed = websiteSettingsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : defaultWebsiteSettings;
}
