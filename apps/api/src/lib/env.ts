import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4177),
  DATABASE_URL: z.url(),
  FRONTEND_URL: z.url(),
  CORS_ALLOWED_ORIGINS: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  CLOUDINARY_FOLDER: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9/_-]+$/)
    .default("world-star"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  TWITCH_CLIENT_ID: optionalString,
  TWITCH_CLIENT_SECRET: optionalString,
  KICK_CLIENT_ID: optionalString,
  KICK_CLIENT_SECRET: optionalString,
  YOUTUBE_API_KEY: optionalString,
  STREAM_STATUS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(3600)
    .default(60),
  YOUTUBE_STATUS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(86_400)
    .default(1800),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const fields = result.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");
  throw new Error(`Invalid server environment. Check: ${fields}`);
}

function normalizeOrigin(value: string): string {
  return new URL(value.trim()).origin;
}

export const env = {
  ...result.data,
  allowedOrigins: [
    ...new Set(
      [
        result.data.FRONTEND_URL,
        ...result.data.CORS_ALLOWED_ORIGINS.split(","),
      ].map(normalizeOrigin),
    ),
  ],
};
