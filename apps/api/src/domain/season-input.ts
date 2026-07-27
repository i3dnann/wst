import { z } from "zod";

export const seasonScoringConfigSchema = z.object({
  win: z.number().int().min(-1_000).max(1_000),
  draw: z.number().int().min(-1_000).max(1_000),
  loss: z.number().int().min(-1_000).max(1_000),
  kill: z.number().int().min(-1_000).max(1_000),
  mvp: z.number().int().min(-1_000).max(1_000),
  tournamentVictory: z.number().int().min(-10_000).max(10_000),
});

const seasonStatusSchema = z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]);

const seasonFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: seasonStatusSchema,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  scoringConfigSnapshot: seasonScoringConfigSchema,
});

function validateSeasonDates(
  value: {
    startsAt: Date;
    endsAt?: Date | null | undefined;
  },
  context: z.RefinementCtx,
): void {
  if (value.endsAt && value.endsAt <= value.startsAt) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "Season end time must be after its start time.",
    });
  }
}

export const seasonInputSchema = seasonFieldsSchema
  .extend({
    status: seasonStatusSchema.default("DRAFT"),
  })
  .superRefine(validateSeasonDates);

// Status-only updates must not run `.partial()` on the refined create schema,
// and they must not inject create defaults into fields the admin did not edit.
export const seasonUpdateInputSchema = seasonFieldsSchema.partial();
