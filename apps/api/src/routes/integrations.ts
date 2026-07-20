import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { fiveMEventSchema } from "@mafia/shared";
import { envelope } from "../lib/envelope.js";
import { env } from "../lib/env.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): void {
  const timestampMs = Number(timestamp);
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS
  ) {
    throw new HttpError(
      401,
      "INTEGRATION_TIMESTAMP_INVALID",
      "Integration timestamp is outside the accepted window.",
    );
  }
  const expected = crypto
    .createHmac("sha256", env.FIVEM_INTEGRATION_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const received = signature.replace(/^sha256=/, "");
  if (
    expected.length !== received.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  ) {
    throw new HttpError(
      401,
      "INTEGRATION_SIGNATURE_INVALID",
      "Integration signature is invalid.",
    );
  }
}

export function integrationRoutes(app: FastifyInstance): void {
  app.post(
    "/api/v1/integrations/fivem/events",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const timestamp = request.headers["x-mafia-timestamp"];
      const signature = request.headers["x-mafia-signature"];
      if (typeof timestamp !== "string" || typeof signature !== "string")
        throw new HttpError(
          401,
          "INTEGRATION_AUTH_REQUIRED",
          "Signed integration headers are required.",
        );
      const rawBody = JSON.stringify(request.body);
      verifySignature(rawBody, timestamp, signature);
      const event = fiveMEventSchema.parse(request.body);
      const payloadHash = crypto
        .createHash("sha256")
        .update(rawBody)
        .digest("hex");
      const syncEvent = await prisma.syncEvent.create({
        data: {
          source: "fivem",
          externalEventId: event.externalEventId,
          type: event.type,
          payloadHash,
          status: "RECEIVED",
        },
      });
      // Processing is intentionally delegated to a worker so ingestion stays bounded and idempotent.
      return envelope(request, { id: syncEvent.id, status: syncEvent.status });
    },
  );
}
