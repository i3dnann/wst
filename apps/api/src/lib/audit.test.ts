import { describe, expect, it } from "vitest";
import { buildDiscordAuditPayload, maskWebhookUrl } from "./audit.js";

describe("Discord audit webhook masking", () => {
  it("does not expose the webhook token", () => {
    const masked = maskWebhookUrl(
      "https://discord.com/api/webhooks/123456789/very-secret-token",
    );

    expect(masked).toBe(
      "https://discord.com/api/webhooks/123456789/••••••••••••",
    );
    expect(masked).not.toContain("very-secret-token");
  });

  it("returns null for an unset webhook", () => {
    expect(maskWebhookUrl("")).toBeNull();
  });
});

describe("Discord audit webhook payload", () => {
  it("includes the acting administrator's display name and email", () => {
    const payload = buildDiscordAuditPayload(
      {
        action: "media.delete",
        entityType: "MediaAsset",
        entityId: "media-123",
        createdAt: new Date("2026-07-24T05:58:00.000Z"),
        actor: {
          displayName: "Administrator",
          email: "admin@wstgang.com",
        },
      },
      "archive",
    );

    const [embed] = payload.embeds as Array<{
      fields: Array<Record<string, unknown>>;
    }>;

    expect(embed?.fields).toEqual(
      expect.arrayContaining([
        {
          name: "Administrator",
          value: "Administrator",
          inline: true,
        },
        {
          name: "Administrator Email",
          value: "admin@wstgang.com",
          inline: true,
        },
        { name: "Record", value: "MediaAsset", inline: true },
      ]),
    );
  });
});
