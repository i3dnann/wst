import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
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
  S3_ENDPOINT: optionalUrl,
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_PUBLIC_BASE_URL: optionalUrl,
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const fields = result.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");
  throw new Error(`Invalid server environment. Check: ${fields}`);
}

export const env = {
  ...result.data,
  allowedOrigins: result.data.CORS_ALLOWED_ORIGINS.split(",").map((origin) =>
    origin.trim(),
  ),
};
