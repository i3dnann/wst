import crypto from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { jwtVerify } from "jose";
import type { Permission } from "@mafia/shared";
import { env } from "../lib/env.js";

interface AccessClaims {
  sub: string;
  permissions: Permission[];
  gangScopes: string[];
}

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  await app.register(cookie, { secret: env.SESSION_SECRET, hook: "onRequest" });
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || env.allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Origin is not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
    const token = request.cookies.mafia_access;
    if (token) {
      try {
        const verified = await jwtVerify(
          token,
          new TextEncoder().encode(env.SESSION_SECRET),
          {
            issuer: "mafia-api",
            audience: "mafia-web",
          },
        );
        const claims = verified.payload as unknown as AccessClaims;
        request.auth = {
          userId: claims.sub,
          permissions: new Set(claims.permissions),
          gangScopes: new Set(claims.gangScopes),
        };
      } catch {
        reply.clearCookie("mafia_access", { path: "/" });
      }
    }

    if (
      ["POST", "PATCH", "PUT", "DELETE"].includes(request.method) &&
      !request.url.startsWith("/api/v1/integrations/")
    ) {
      const csrfCookie = request.cookies.mafia_csrf;
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
