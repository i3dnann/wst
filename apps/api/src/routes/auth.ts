import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { adminLoginSchema } from "@mafia/shared";
import { SignJWT } from "jose";
import { envelope } from "../lib/envelope.js";
import { env } from "../lib/env.js";
import { HttpError } from "../lib/http-error.js";
import { verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/authorize.js";

const cookieOptions = {
  path: "/",
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

async function createAccessToken(userId: string): Promise<string> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  const permissions = [
    ...new Set(
      userRoles.flatMap((entry) =>
        entry.role.permissions.map((item) => item.permission.key),
      ),
    ),
  ];
  const gangScopes = [
    ...new Set(
      userRoles.flatMap((entry) => (entry.gangId ? [entry.gangId] : [])),
    ),
  ];
  return new SignJWT({ permissions, gangScopes })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("wst-api")
    .setAudience("wst-web")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(env.SESSION_SECRET));
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

function setSessionCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
  csrf: string,
): void {
  reply.setCookie("wst_access", accessToken, {
    ...cookieOptions,
    maxAge: 900,
  });
  reply.setCookie("wst_refresh", refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60,
  });
  reply.setCookie("wst_csrf", csrf, {
    path: "/",
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 900,
  });
}

export function authRoutes(app: FastifyInstance): void {
  app.post(
    "/api/v1/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const input = adminLoginSchema.parse(request.body);
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      });
      const valid =
        user?.passwordHash &&
        user.status === "ACTIVE" &&
        (await verifyPassword(input.password, user.passwordHash));

      if (!user || !valid) {
        throw new HttpError(
          401,
          "LOGIN_INVALID",
          "The administrator email or password is incorrect.",
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      const accessToken = await createAccessToken(user.id);
      const refreshToken = await issueRefreshToken(user.id);
      const csrf = crypto.randomBytes(24).toString("base64url");
      setSessionCookies(reply, accessToken, refreshToken, csrf);
      return envelope(request, {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      });
    },
  );

  app.get("/api/v1/auth/me", async (request) => {
    const auth = requireAuth(request);
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
      },
    });
    if (!user)
      throw new HttpError(401, "SESSION_INVALID", "Session is invalid.");
    return envelope(request, {
      ...user,
      permissions: [...auth.permissions],
      gangScopes: [...auth.gangScopes],
    });
  });

  app.post(
    "/api/v1/auth/refresh",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const current = request.cookies.wst_refresh;
      if (!current)
        throw new HttpError(
          401,
          "REFRESH_REQUIRED",
          "Refresh session is missing.",
        );
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(current) },
      });
      if (!stored || stored.revokedAt || stored.expiresAt <= new Date())
        throw new HttpError(
          401,
          "REFRESH_INVALID",
          "Refresh session is invalid or expired.",
        );
      const replacement = crypto.randomBytes(48).toString("base64url");
      await prisma.$transaction([
        prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        }),
        prisma.refreshToken.create({
          data: {
            userId: stored.userId,
            tokenHash: hashToken(replacement),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            metadata: { rotatedFrom: stored.id },
          },
        }),
      ]);
      const accessToken = await createAccessToken(stored.userId);
      const csrf = crypto.randomBytes(24).toString("base64url");
      setSessionCookies(reply, accessToken, replacement, csrf);
      return reply.code(204).send();
    },
  );

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const refresh = request.cookies.wst_refresh;
    if (refresh)
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refresh), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    reply.clearCookie("wst_access", { path: "/" });
    reply.clearCookie("wst_refresh", { path: "/" });
    reply.clearCookie("wst_csrf", { path: "/" });
    return reply.code(204).send();
  });
}
