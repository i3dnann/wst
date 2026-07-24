import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { realtimeHub } from "./realtime.js";

export const discordAuditSettingKey = "discord.audit";

export const discordAuditCategories = [
  "create",
  "update",
  "archive",
  "admin",
  "security",
] as const;

export type DiscordAuditCategory = (typeof discordAuditCategories)[number];

export interface DiscordAuditConfig {
  enabled: boolean;
  webhookUrl: string;
  categories: DiscordAuditCategory[];
}

const defaultCategories = [...discordAuditCategories];

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isCategory(value: unknown): value is DiscordAuditCategory {
  return (
    typeof value === "string" &&
    discordAuditCategories.includes(value as DiscordAuditCategory)
  );
}

export async function getDiscordAuditConfig(): Promise<DiscordAuditConfig> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: discordAuditSettingKey },
    select: { value: true },
  });
  const value = setting?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { enabled: false, webhookUrl: "", categories: defaultCategories };
  }
  const record = value as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    webhookUrl: typeof record.webhookUrl === "string" ? record.webhookUrl : "",
    categories: Array.isArray(record.categories)
      ? record.categories.filter(isCategory)
      : defaultCategories,
  };
}

export function maskWebhookUrl(webhookUrl: string): string | null {
  if (!webhookUrl) return null;
  const parts = webhookUrl.split("/");
  const id = parts.at(-2);
  return id ? `https://discord.com/api/webhooks/${id}/••••••••••••` : null;
}

function categoryForAction(action: string): DiscordAuditCategory {
  if (action.startsWith("admin.") || action.startsWith("role.")) return "admin";
  if (action.startsWith("auth.") || action.startsWith("security."))
    return "security";
  if (
    action.includes("archive") ||
    action.includes("remove") ||
    action.includes("delete") ||
    action.includes("disable")
  )
    return "archive";
  if (action.includes("create") || action.includes("add")) return "create";
  return "update";
}

export async function executeDiscordWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${webhookUrl}?wait=true`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...payload }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Discord returned HTTP ${String(response.status)}.`);
  }
}

async function dispatchAuditWebhook(auditId: string): Promise<void> {
  const [config, audit] = await Promise.all([
    getDiscordAuditConfig(),
    prisma.auditLog.findUnique({
      where: { id: auditId },
      include: {
        actor: { select: { displayName: true, email: true } },
      },
    }),
  ]);
  if (!audit || !config.enabled || !config.webhookUrl) return;
  const category = categoryForAction(audit.action);
  if (!config.categories.includes(category)) return;

  await executeDiscordWebhook(config.webhookUrl, {
    username: "World Star Audit",
    embeds: [
      {
        title: audit.action.replaceAll(".", " ").toUpperCase(),
        color: category === "archive" ? 10_033_224 : 13_147_218,
        fields: [
          {
            name: "Administrator",
            value: audit.actor?.displayName ?? audit.actor?.email ?? "System",
            inline: true,
          },
          { name: "Record", value: audit.entityType, inline: true },
          {
            name: "Record ID",
            value: audit.entityId ?? "Not available",
            inline: false,
          },
        ],
        footer: { text: "World Star administration" },
        timestamp: audit.createdAt.toISOString(),
      },
    ],
  });
}

export async function recordAudit(input: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string;
}): Promise<void> {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
  };
  if (input.entityId !== undefined) data.entityId = input.entityId;
  if (input.beforeData !== undefined)
    data.beforeData = asJson(input.beforeData);
  if (input.afterData !== undefined) data.afterData = asJson(input.afterData);
  if (input.reason !== undefined) data.reason = input.reason;
  const audit = await prisma.auditLog.create({
    data,
  });
  realtimeHub.publish("data.changed", {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
  });
  void dispatchAuditWebhook(audit.id).catch(async (error: unknown) => {
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: null,
          action: "integration.discord.delivery-failed",
          entityType: "AuditLog",
          entityId: audit.id,
          afterData: asJson({
            message:
              error instanceof Error
                ? error.message
                : "Discord delivery failed.",
          }),
        },
      });
    } catch {
      process.emitWarning(
        "Discord audit delivery failed and its failure could not be persisted.",
      );
    }
  });
}
