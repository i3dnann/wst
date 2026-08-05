import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { envelope } from "../lib/envelope.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { recordAudit } from "../lib/audit.js";
import { requirePermission } from "../middleware/authorize.js";
import {
  GIFT_CLAIM_WINDOW_MS,
  giftAvailableAt,
  giftIsClaimed,
  publicGiftStatus,
} from "../domain/gift-challenge.js";

const CHALLENGE_ID = "daily-gift";
const DEFAULT_CODE = "Adnanwashere2001";
const DEFAULT_CLAIM_MESSAGE =
  "DM a World Star administrator on Discord and send this code to claim your gift.";
const REQUIRED_CLICKS = 100;
const ATTEMPT_WINDOW_MS = 30 * 60 * 1_000;
const tokenInput = z.object({ token: z.string().min(32).max(128) });
const sessionInput = z.object({ token: z.string().min(32).max(128).optional() });
const settingsInput = z.object({
  code: z.string().trim().min(4).max(255),
  claimMessage: z.string().trim().min(10).max(1_000),
});

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function ensureChallenge() {
  return prisma.giftChallenge.upsert({
    where: { id: CHALLENGE_ID },
    update: {},
    create: {
      id: CHALLENGE_ID,
      code: DEFAULT_CODE,
      claimMessage: DEFAULT_CLAIM_MESSAGE,
      requiredClicks: REQUIRED_CLICKS,
    },
  });
}

export function giftRoutes(app: FastifyInstance): void {
  app.get("/api/v1/gift", async (request) => {
    const challenge = await ensureChallenge();
    return envelope(request, publicGiftStatus(challenge));
  });

  app.post(
    "/api/v1/gift/session",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const input = sessionInput.parse(request.body ?? {});
      const challenge = await ensureChallenge();
      const now = new Date();
      const suppliedHash = input.token ? tokenHash(input.token) : null;

      if (giftIsClaimed(challenge.claimedAt, now)) {
        const winner =
          suppliedHash !== null && challenge.claimTokenHash === suppliedHash;
        return envelope(request, {
          ...publicGiftStatus(challenge),
          progress: winner ? challenge.requiredClicks : 0,
          code: winner ? (challenge.claimedCode ?? challenge.code) : null,
          claimMessage: winner
            ? (challenge.claimMessage ?? DEFAULT_CLAIM_MESSAGE)
            : null,
          token: winner ? input.token : null,
          winner,
        });
      }

      if (suppliedHash) {
        const existing = await prisma.giftChallengeAttempt.findFirst({
          where: { tokenHash: suppliedHash, expiresAt: { gt: now } },
        });
        if (existing) {
          return envelope(request, {
            ...publicGiftStatus(challenge),
            progress: Math.min(existing.progress, challenge.requiredClicks),
            code: null,
            token: input.token,
            winner: false,
          });
        }
      }

      const token = crypto.randomBytes(32).toString("base64url");
      await prisma.giftChallengeAttempt.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      await prisma.giftChallengeAttempt.create({
        data: {
          tokenHash: tokenHash(token),
          expiresAt: new Date(now.getTime() + ATTEMPT_WINDOW_MS),
        },
      });
      return envelope(request, {
        ...publicGiftStatus(challenge),
        progress: 0,
        code: null,
        token,
        winner: false,
      });
    },
  );

  app.post(
    "/api/v1/gift/click",
    { config: { rateLimit: { max: 180, timeWindow: "1 minute" } } },
    async (request) => {
      const { token } = tokenInput.parse(request.body);
      const hash = tokenHash(token);
      const now = new Date();
      const challenge = await ensureChallenge();

      if (giftIsClaimed(challenge.claimedAt, now)) {
        const winner = challenge.claimTokenHash === hash;
        return envelope(request, {
          ...publicGiftStatus(challenge),
          progress: winner ? challenge.requiredClicks : 0,
          code: winner ? (challenge.claimedCode ?? challenge.code) : null,
          claimMessage: winner
            ? (challenge.claimMessage ?? DEFAULT_CLAIM_MESSAGE)
            : null,
          winner,
        });
      }

      const incremented = await prisma.giftChallengeAttempt.updateMany({
        where: {
          tokenHash: hash,
          expiresAt: { gt: now },
          progress: { lt: challenge.requiredClicks },
        },
        data: { progress: { increment: 1 } },
      });
      if (incremented.count !== 1) {
        throw new HttpError(
          409,
          "GIFT_SESSION_EXPIRED",
          "This challenge session expired. Start the challenge again.",
        );
      }

      const attempt = await prisma.giftChallengeAttempt.findUniqueOrThrow({
        where: { tokenHash: hash },
      });
      if (attempt.progress < challenge.requiredClicks) {
        return envelope(request, {
          ...publicGiftStatus(challenge),
          progress: attempt.progress,
          code: null,
          winner: false,
        });
      }

      const cutoff = new Date(now.getTime() - GIFT_CLAIM_WINDOW_MS);
      const claim = await prisma.giftChallenge.updateMany({
        where: {
          id: CHALLENGE_ID,
          OR: [{ claimedAt: null }, { claimedAt: { lte: cutoff } }],
        },
        data: { claimedAt: now, claimedCode: challenge.code, claimTokenHash: hash },
      });
      const current = await ensureChallenge();
      const winner =
        (claim.count === 1 || current.claimTokenHash === hash) &&
        giftIsClaimed(current.claimedAt, now);
      return envelope(request, {
        ...publicGiftStatus(current),
        progress: winner ? current.requiredClicks : attempt.progress,
        code: winner ? (current.claimedCode ?? current.code) : null,
        claimMessage: winner
          ? (current.claimMessage ?? DEFAULT_CLAIM_MESSAGE)
          : null,
        winner,
      });
    },
  );

  app.get("/api/v1/admin/gift", async (request) => {
    requirePermission(request, "settings.manage");
    const challenge = await ensureChallenge();
    return envelope(request, {
      code: challenge.code,
      claimMessage: challenge.claimMessage ?? DEFAULT_CLAIM_MESSAGE,
      requiredClicks: challenge.requiredClicks,
      claimedAt: challenge.claimedAt,
      nextAvailableAt: giftAvailableAt(challenge.claimedAt),
      claimed: giftIsClaimed(challenge.claimedAt),
    });
  });

  app.patch("/api/v1/admin/gift", async (request) => {
    const auth = requirePermission(request, "settings.manage");
    const input = settingsInput.parse(request.body);
    const challenge = await prisma.giftChallenge.upsert({
      where: { id: CHALLENGE_ID },
      update: {
        code: input.code,
        claimMessage: input.claimMessage,
        updatedByUserId: auth.userId,
      },
      create: {
        id: CHALLENGE_ID,
        code: input.code,
        claimMessage: input.claimMessage,
        requiredClicks: REQUIRED_CLICKS,
        updatedByUserId: auth.userId,
      },
    });
    await recordAudit({
      actorUserId: auth.userId,
      action: "gift.settings.update",
      entityType: "GiftChallenge",
      entityId: challenge.id,
      afterData: { codeChanged: true, claimMessageChanged: true },
    });
    return envelope(request, { updated: true });
  });

  app.post("/api/v1/admin/gift/reset", async (request) => {
    const auth = requirePermission(request, "settings.manage");
    const challenge = await ensureChallenge();
    await prisma.$transaction([
      prisma.giftChallenge.update({
        where: { id: CHALLENGE_ID },
        data: { claimedAt: null, claimedCode: null, claimTokenHash: null, updatedByUserId: auth.userId },
      }),
      prisma.giftChallengeAttempt.deleteMany(),
    ]);
    await recordAudit({
      actorUserId: auth.userId,
      action: "gift.claim.reset",
      entityType: "GiftChallenge",
      entityId: challenge.id,
      afterData: { reset: true },
    });
    return envelope(request, { reset: true });
  });
}
