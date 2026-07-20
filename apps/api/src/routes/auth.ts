import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { envelope } from "../lib/envelope.js";
import { env } from "../lib/env.js";
import { HttpError } from "../lib/http-error.js";
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
    .setIssuer("mafia-api")
    .setAudience("mafia-web")
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

export function authRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/auth/discord",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (_request, reply) => {
      if (!env.DISCORD_CLIENT_ID || !env.DISCORD_REDIRECT_URI)
        throw new HttpError(
          503,
          "OAUTH_NOT_CONFIGURED",
          "Discord login is not configured.",
        );
      const state = crypto.randomBytes(32).toString("base64url");
      reply.setCookie("oauth_state", state, { ...cookieOptions, maxAge: 600 });
      const query = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify",
        state,
      });
      return reply.redirect(
        `https://discord.com/oauth2/authorize?${query.toString()}`,
      );
    },
  );

  app.get<{ Querystring: { code?: string; state?: string } }>(
    "/api/v1/auth/discord/callback",
    async (request, reply) => {
      if (
        !env.DISCORD_CLIENT_ID ||
        !env.DISCORD_CLIENT_SECRET ||
        !env.DISCORD_REDIRECT_URI
      )
        throw new HttpError(
          503,
          "OAUTH_NOT_CONFIGURED",
          "Discord login is not configured.",
        );
      if (
        !request.query.code ||
        !request.query.state ||
        request.query.state !== request.cookies.oauth_state
      )
        throw new HttpError(
          400,
          "OAUTH_STATE_INVALID",
          "OAuth state validation failed.",
        );

      const tokenResponse = await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code: request.query.code,
            redirect_uri: env.DISCORD_REDIRECT_URI,
          }),
        },
      );
      if (!tokenResponse.ok)
        throw new HttpError(
          502,
          "OAUTH_EXCHANGE_FAILED",
          "Discord authentication failed.",
        );
      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
      };
      const identityResponse = await fetch(
        "https://discord.com/api/users/@me",
        { headers: { authorization: `Bearer ${tokenData.access_token}` } },
      );
      if (!identityResponse.ok)
        throw new HttpError(
          502,
          "OAUTH_IDENTITY_FAILED",
          "Discord identity could not be retrieved.",
        );
      const identity = (await identityResponse.json()) as {
        id: string;
        username: string;
        global_name?: string | null;
        avatar?: string | null;
      };
      const avatarUrl = identity.avatar
        ? `https://cdn.discordapp.com/avatars/${identity.id}/${identity.avatar}.png`
        : null;
      const user = await prisma.user.upsert({
        where: { discordId: identity.id },
        update: {
          username: identity.username,
          displayName: identity.global_name ?? identity.username,
          avatarUrl,
          lastLoginAt: new Date(),
        },
        create: {
          discordId: identity.id,
          username: identity.username,
          displayName: identity.global_name ?? identity.username,
          avatarUrl,
          lastLoginAt: new Date(),
        },
      });
      const accessToken = await createAccessToken(user.id);
      const refreshToken = await issueRefreshToken(user.id);
      const csrf = crypto.randomBytes(24).toString("base64url");
      reply.setCookie("mafia_access", accessToken, {
        ...cookieOptions,
        maxAge: 900,
      });
      reply.setCookie("mafia_refresh", refreshToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60,
      });
      reply.setCookie("mafia_csrf", csrf, {
        path: "/",
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 900,
      });
      reply.clearCookie("oauth_state", { path: "/" });
      return reply.redirect(`${env.FRONTEND_URL}/dashboard`);
    },
  );

  app.get("/api/v1/auth/me", async (request) => {
    const auth = requireAuth(request);
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
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
      const current = request.cookies.mafia_refresh;
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
      reply.setCookie("mafia_access", accessToken, {
        ...cookieOptions,
        maxAge: 900,
      });
      reply.setCookie("mafia_refresh", replacement, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60,
      });
      reply.setCookie("mafia_csrf", csrf, {
        path: "/",
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 900,
      });
      return reply.code(204).send();
    },
  );

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const refresh = request.cookies.mafia_refresh;
    if (refresh)
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refresh), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    reply.clearCookie("mafia_access", { path: "/" });
    reply.clearCookie("mafia_refresh", { path: "/" });
    reply.clearCookie("mafia_csrf", { path: "/" });
    return reply.code(204).send();
  });
}
