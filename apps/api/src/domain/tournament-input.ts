import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const httpsUrlSchema = z.url().refine((value) => value.startsWith("https://"), {
  message: "Only HTTPS URLs are allowed.",
});

const tournamentStatusSchema = z.enum([
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
]);

const tournamentRulesSchema = z
  .string()
  .trim()
  .max(20_000)
  .refine(
    (value) =>
      value.split(/\r?\n/).filter((rule) => Boolean(rule.trim())).length <= 20,
    "A tournament can have a maximum of 20 rules.",
  )
  .nullable()
  .optional();

export const tournamentPrizeSchema = z.object({
  placement: z.number().int().min(1).max(3),
  title: z.string().trim().min(1).max(120),
  amount: z.string().trim().min(1).max(120),
  imageUrl: httpsUrlSchema.nullable().optional(),
});

export const tournamentPrizesSchema = z
  .array(tournamentPrizeSchema)
  .max(3)
  .superRefine((prizes, context) => {
    const placements = new Set<number>();
    for (const [index, prize] of prizes.entries()) {
      if (placements.has(prize.placement)) {
        context.addIssue({
          code: "custom",
          path: [index, "placement"],
          message: "Each tournament placement can only have one prize.",
        });
      }
      placements.add(prize.placement);
    }
  });

const tournamentFieldsSchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: slugSchema,
  description: z.string().trim().max(4000).optional(),
  bannerUrl: httpsUrlSchema.optional(),
  format: z.enum([
    "SINGLE_ELIMINATION",
    "DOUBLE_ELIMINATION",
    "ROUND_ROBIN",
    "GROUP_KNOCKOUT",
    "CUSTOM",
  ]),
  status: tournamentStatusSchema,
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  registrationOpenAt: z.coerce.date().optional(),
  registrationCloseAt: z.coerce.date().optional(),
  seasonId: z.string().min(20).max(40).nullable().optional(),
  maximumParticipants: z.number().int().min(2).max(256),
  rules: tournamentRulesSchema,
  prizeDescription: z.string().trim().max(1000).optional(),
  prizes: tournamentPrizesSchema.optional(),
  featured: z.boolean(),
  publicVisible: z.boolean(),
});

function validateTournamentDates(
  value: {
    startAt: Date;
    endAt?: Date | undefined;
    registrationOpenAt?: Date | undefined;
    registrationCloseAt?: Date | undefined;
  },
  context: z.RefinementCtx,
): void {
  if (value.endAt && value.endAt <= value.startAt) {
    context.addIssue({
      code: "custom",
      path: ["endAt"],
      message: "End time must be after the start time.",
    });
  }
  if (
    value.registrationOpenAt &&
    value.registrationCloseAt &&
    value.registrationCloseAt <= value.registrationOpenAt
  ) {
    context.addIssue({
      code: "custom",
      path: ["registrationCloseAt"],
      message: "Registration close time must be after registration opens.",
    });
  }
  if (value.registrationCloseAt && value.registrationCloseAt > value.startAt) {
    context.addIssue({
      code: "custom",
      path: ["registrationCloseAt"],
      message: "Registration must close before the tournament starts.",
    });
  }
}

export const tournamentInputSchema = tournamentFieldsSchema
  .extend({
    status: tournamentStatusSchema.default("DRAFT"),
    featured: z.boolean().default(false),
    publicVisible: z.boolean().default(true),
  })
  .superRefine(validateTournamentDates);

// Update input intentionally has no defaults. Applying create defaults to a
// partial payload can silently reset fields the administrator did not edit.
export const tournamentUpdateInputSchema = tournamentFieldsSchema.partial();

export const tournamentBannerInputSchema = z.object({
  bannerUrl: httpsUrlSchema.nullable(),
});
