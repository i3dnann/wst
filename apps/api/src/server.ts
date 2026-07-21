import "dotenv/config";
import Fastify from "fastify";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSecurity } from "./plugins/security.js";
import { adminRoutes } from "./routes/admin.js";
import { adminExtendedRoutes } from "./routes/admin-extended.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { mediaRoutes } from "./routes/media.js";
import { publicRoutes } from "./routes/public.js";

const app = Fastify({
  logger: { level: env.LOG_LEVEL },
  bodyLimit: 1_048_576,
  requestIdHeader: "x-request-id",
  genReqId: (request) =>
    request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
  trustProxy: env.NODE_ENV === "production",
});

await registerSecurity(app);
registerErrorHandler(app);
healthRoutes(app);
publicRoutes(app);
authRoutes(app);
adminRoutes(app);
adminExtendedRoutes(app);
mediaRoutes(app);

const close = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void close("SIGINT"));
process.on("SIGTERM", () => void close("SIGTERM"));

await app.listen({ host: "0.0.0.0", port: env.PORT });
