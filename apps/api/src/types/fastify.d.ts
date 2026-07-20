import type { Permission } from "@mafia/shared";

declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: string;
      permissions: Set<Permission>;
      gangScopes: Set<string>;
    } | null;
  }
}

export {};
