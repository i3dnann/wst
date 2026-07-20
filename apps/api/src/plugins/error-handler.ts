import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { HttpError } from "../lib/http-error.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
    }
    if (error instanceof ZodError) {
      return reply.code(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request is invalid.",
          details: z.treeifyError(error),
          requestId: request.id,
        },
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return reply.code(409).send({
        error: {
          code: "CONFLICT",
          message: "A record with these unique values already exists.",
          requestId: request.id,
        },
      });
    }
    request.log.error({ err: error, requestId: request.id }, "request failed");
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        requestId: request.id,
      },
    });
  });
}
