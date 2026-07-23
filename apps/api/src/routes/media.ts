import crypto from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { envelope } from "../lib/envelope.js";
import { recordAudit } from "../lib/audit.js";
import { env } from "../lib/env.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { requirePermission } from "../middleware/authorize.js";

const imageMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
const videoMimeTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
const acceptedMimeTypes = [...imageMimeTypes, ...videoMimeTypes] as const;

const uploadRequestSchema = z
  .object({
    category: z.enum([
      "gang-logo",
      "gang-banner",
      "player-avatar",
      "tournament-banner",
      "event-image",
      "event-video",
      "stream-thumbnail",
      "website-media",
      "match-evidence",
    ]),
    filename: z.string().trim().min(1).max(180),
    mimeType: z.enum(acceptedMimeTypes),
    size: z.number().int().positive().max(100 * 1024 * 1024),
    gangId: z.string().min(20).max(40).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.mimeType.startsWith("image/") &&
      value.size > 12 * 1024 * 1024
    ) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: "Images must be 12 MB or smaller.",
      });
    }
  });

function cloudinaryCredentials() {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw new HttpError(
      503,
      "MEDIA_NOT_CONFIGURED",
      "Cloudinary media storage is not configured.",
    );
  }
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  };
}

export function mediaRoutes(app: FastifyInstance): void {
  app.post("/api/v1/media/upload-intent", async (request) => {
    const auth = requirePermission(request, "media.upload");
    const input = uploadRequestSchema.parse(request.body);
    const credentials = cloudinaryCredentials();
    const resourceType = input.mimeType.startsWith("video/")
      ? "video"
      : "image";
    const date = new Date().toISOString().slice(0, 10);
    const publicId = `${env.CLOUDINARY_FOLDER}/${input.category}/${date}/${crypto.randomUUID()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { public_id: publicId, timestamp },
      credentials.apiSecret,
    );

    const media = await prisma.mediaAsset.create({
      data: {
        uploaderUserId: auth.userId,
        gangId: input.gangId ?? null,
        category: input.category,
        originalFilename: input.filename,
        storageKey: publicId,
        publicUrl: `pending:${publicId}`,
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
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(credentials.cloudName)}/${resourceType}/upload`,
      cloudName: credentials.cloudName,
      apiKey: credentials.apiKey,
      publicId,
      resourceType,
      timestamp,
      signature,
      acceptedMimeTypes,
      maximumBytes:
        resourceType === "video" ? 100 * 1024 * 1024 : 12 * 1024 * 1024,
    });
  });
}
