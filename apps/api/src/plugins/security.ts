import crypto from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { jwtVerify } from "jose";
import { permissions, type Permission } from "@mafia/shared";
import { z } from "zod";
import { env } from "../lib/env.js";

const accessClaimsSchema = z.object({
  sub: z.string().min(20).max(40),
  permissions: z.array(z.string()).max(200),
  gangScopes: z.array(z.string().min(20).max(40)).max(500),
});
const permissionKeys = new Set<string>(Object.values(permissions));

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  await app.register(cookie, { secret: env.SESSION_SECRET, hook: "onRequest" });
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || env.allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Origin is not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    hsts:
      env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });

  app.decorateRequest("auth", null);
  app.addHook("onRequest", async (request, reply) => {
    const token = request.cookies.wst_access;
    if (token) {
      try {
        const verified = await jwtVerify(
          token,
          new TextEncoder().encode(env.SESSION_SECRET),
          {
            issuer: "wst-api",
            audience: "wst-web",
          },
        );
        const claims = accessClaimsSchema.parse(verified.payload);
        const granted = claims.permissions.filter(
          (permission): permission is Permission =>
            permissionKeys.has(permission),
        );
        if (granted.length !== claims.permissions.length)
          throw new Error("JWT contains an unknown permission.");
        request.auth = {
          userId: claims.sub,
          permissions: new Set(granted),
          gangScopes: new Set(claims.gangScopes),
        };
      } catch {
        reply.clearCookie("wst_access", { path: "/" });
      }
    }

    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      const csrfCookie = request.cookies.wst_csrf;
      const csrfHeader = request.headers["x-csrf-token"];
      const csrfMatches =
        csrfCookie &&
        typeof csrfHeader === "string" &&
        csrfCookie.length === csrfHeader.length &&
        crypto.timingSafeEqual(
          Buffer.from(csrfCookie),
          Buffer.from(csrfHeader),
        );
      if (request.auth && !csrfMatches) {
        return reply.code(403).send({
          error: {
            code: "CSRF_INVALID",
            message: "CSRF token is missing or invalid.",
            requestId: request.id,
          },
        });
      }
    }
  });
}
