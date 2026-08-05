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
const REVEAL_WINDOW_MS = 20 * 1_000;
const ANSWER_WINDOW_MS = 20 * 1_000;
const ATTEMPT_WINDOW_MS = REVEAL_WINDOW_MS + ANSWER_WINDOW_MS;
const PUZZLE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tokenInput = z.object({ token: z.string().min(32).max(128) });
const answerInput = tokenInput.extend({ answer: z.string().trim().min(10).max(11) });
const sessionInput = z.object({
  token: z.string().min(32).max(128).optional(),
  restart: z.boolean().optional().default(false),
});
const settingsInput = z.object({
  code: z.string().trim().min(4).max(255),
  claimMessage: z.string().trim().min(10).max(1_000),
});

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createPuzzleCode(): string {
  const raw = Array.from(crypto.randomBytes(10), (value) =>
    PUZZLE_ALPHABET[value % PUZZLE_ALPHABET.length] ?? "X",
  ).join("");
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function puzzleAttemptState(attempt: { puzzleCode: string | null; revealUntil: Date | null; answerUntil: Date | null; attemptsRemaining: number }, now: Date) {
  const revealing = Boolean(attempt.revealUntil && attempt.revealUntil > now);
  return {
    puzzleCode: revealing ? attempt.puzzleCode : null,
    revealUntil: attempt.revealUntil,
    answerUntil: attempt.answerUntil,
    attemptsRemaining: attempt.attemptsRemaining,
  };
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

      if (suppliedHash && !input.restart) {
        const existing = await prisma.giftChallengeAttempt.findFirst({
          where: { tokenHash: suppliedHash, expiresAt: { gt: now } },
        });
        if (
          existing?.puzzleCode &&
          existing.revealUntil &&
          existing.answerUntil &&
          existing.answerUntil > now &&
          existing.attemptsRemaining > 0
        ) {
          return envelope(request, {
            ...publicGiftStatus(challenge),
            ...puzzleAttemptState(existing, now),
            code: null,
            token: input.token,
            winner: false,
          });
        }
      }

      const token = crypto.randomBytes(32).toString("base64url");
      const revealUntil = new Date(now.getTime() + REVEAL_WINDOW_MS);
      const answerUntil = new Date(revealUntil.getTime() + ANSWER_WINDOW_MS);
      await prisma.giftChallengeAttempt.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      await prisma.giftChallengeAttempt.create({
        data: {
          tokenHash: tokenHash(token),
          puzzleCode: createPuzzleCode(),
          revealUntil,
          answerUntil,
          attemptsRemaining: 3,
          expiresAt: new Date(now.getTime() + ATTEMPT_WINDOW_MS),
        },
      });
      const created = await prisma.giftChallengeAttempt.findUniqueOrThrow({ where: { tokenHash: tokenHash(token) } });
      return envelope(request, {
        ...publicGiftStatus(challenge),
        ...puzzleAttemptState(created, now),
        code: null,
        token,
        winner: false,
      });
    },
  );

  app.post(
    "/api/v1/gift/answer",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const { token, answer } = answerInput.parse(request.body);
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

      const attempt = await prisma.giftChallengeAttempt.findUnique({ where: { tokenHash: hash } });
      if (!attempt?.puzzleCode || !attempt.revealUntil || !attempt.answerUntil || attempt.answerUntil <= now || attempt.attemptsRemaining <= 0) {
        throw new HttpError(409, "GIFT_SESSION_EXPIRED", "This puzzle expired. Start a new challenge.");
      }
      if (attempt.revealUntil > now) {
        throw new HttpError(409, "GIFT_REVEAL_ACTIVE", "Wait until the code is hidden before answering.");
      }
      if (answer.toUpperCase() !== attempt.puzzleCode) {
        const updated = await prisma.giftChallengeAttempt.update({
          where: { tokenHash: hash },
          data: { attemptsRemaining: { decrement: 1 } },
        });
        return envelope(request, {
          ...publicGiftStatus(challenge),
          ...puzzleAttemptState(updated, now),
          code: null,
          winner: false,
          correct: false,
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
        ...puzzleAttemptState(attempt, now),
        code: winner ? (current.claimedCode ?? current.code) : null,
        claimMessage: winner
          ? (current.claimMessage ?? DEFAULT_CLAIM_MESSAGE)
          : null,
        winner,
        correct: winner,
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
