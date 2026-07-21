import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { envelope } from "../lib/envelope.js";
import { recordAudit } from "../lib/audit.js";
import { env } from "../lib/env.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { requirePermission } from "../middleware/authorize.js";

const uploadRequestSchema = z.object({
  category: z.enum([
    "gang-logo",
    "gang-banner",
    "player-avatar",
    "tournament-banner",
    "event-image",
    "website-media",
    "match-evidence",
  ]),
  filename: z.string().min(1).max(180),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  size: z
    .number()
    .int()
    .positive()
    .max(8 * 1024 * 1024),
  gangId: z.string().min(20).max(40).optional(),
});

function createS3(): S3Client {
  if (
    !env.S3_ENDPOINT ||
    !env.S3_ACCESS_KEY_ID ||
    !env.S3_SECRET_ACCESS_KEY ||
    !env.S3_BUCKET ||
    !env.S3_PUBLIC_BASE_URL
  ) {
    throw new HttpError(
      503,
      "MEDIA_NOT_CONFIGURED",
      "Persistent media storage is not configured.",
    );
  }
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

export function mediaRoutes(app: FastifyInstance): void {
  app.post("/api/v1/media/upload-intent", async (request) => {
    const auth = requirePermission(request, "media.upload");
    const input = uploadRequestSchema.parse(request.body);
    const publicBaseUrl = env.S3_PUBLIC_BASE_URL;
    if (!publicBaseUrl)
      throw new HttpError(
        503,
        "MEDIA_NOT_CONFIGURED",
        "Persistent media storage is not configured.",
      );
    const extension =
      input.mimeType === "image/png"
        ? "png"
        : input.mimeType === "image/webp"
          ? "webp"
          : "jpg";
    const storageKey = `${input.category}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
      ContentType: input.mimeType,
      ContentLength: input.size,
      Metadata: { moderation: "pending" },
    });
    const uploadUrl = await getSignedUrl(createS3(), command, {
      expiresIn: 300,
    });
    const media = await prisma.mediaAsset.create({
      data: {
        uploaderUserId: auth.userId,
        gangId: input.gangId ?? null,
        category: input.category,
        originalFilename: input.filename,
        storageKey,
        publicUrl: `${publicBaseUrl.replace(/\/$/, "")}/${storageKey}`,
        mimeType: input.mimeType,
        size: input.size,
      },
    });
    await recordAudit({
      actorUserId: auth.userId,
      action: "media.upload.intent.create",
      entityType: "MediaAsset",
      entityId: media.id,
      afterData: media,
    });
    return envelope(request, {
      mediaAssetId: media.id,
      storageKey,
      uploadUrl,
      publicUrl: media.publicUrl,
      expiresIn: 300,
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      maximumBytes: 8 * 1024 * 1024,
    });
  });
}
