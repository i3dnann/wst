import type { FastifyRequest } from "fastify";

export function envelope<T>(
  request: FastifyRequest,
  data: T,
  extra: Record<string, number> = {},
) {
  return {
    data,
    meta: {
      requestId: request.id,
      timestamp: new Date().toISOString(),
      ...extra,
    },
  };
}
