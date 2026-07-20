import { describe, expect, it } from "vitest";
import { maskWebhookUrl } from "./audit.js";

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
