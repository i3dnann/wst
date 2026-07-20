import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export function healthRoutes(app: FastifyInstance): void {
  app.get("/health/live", () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ready", dependencies: { database: "available" } };
    } catch {
      return reply.code(503).send({
        status: "not_ready",
        dependencies: { database: "unavailable" },
      });
    }
  });
}
