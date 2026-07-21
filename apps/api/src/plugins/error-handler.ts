import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { HttpError } from "../lib/http-error.js";

type StatusError = Error & {
  statusCode?: number;
  code?: string;
};

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
      const firstIssue = error.issues[0];
      const field = firstIssue?.path.join(".");
      return reply.code(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: firstIssue
            ? `${field ? `${field}: ` : ""}${firstIssue.message}`
            : "The request is invalid.",
          details: z.treeifyError(error),
          requestId: request.id,
        },
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped =
        error.code === "P2002"
          ? {
              status: 409,
              code: "CONFLICT",
              message: "A record with these unique values already exists.",
            }
          : error.code === "P2025"
            ? {
                status: 404,
                code: "NOT_FOUND",
                message: "The requested record was not found.",
              }
            : error.code === "P2003"
              ? {
                  status: 409,
                  code: "DEPENDENCY_CONFLICT",
                  message: "This operation is blocked by a related record.",
                }
              : null;
      if (mapped) {
        return reply.code(mapped.status).send({
          error: {
            code: mapped.code,
            message: mapped.message,
            requestId: request.id,
          },
        });
      }
    }
    const statusError = error as StatusError;
    if (
      typeof statusError.statusCode === "number" &&
      statusError.statusCode >= 400 &&
      statusError.statusCode < 600
    ) {
      return reply.code(statusError.statusCode).send({
        error: {
          code:
            statusError.statusCode === 429
              ? "RATE_LIMITED"
              : (statusError.code ?? "REQUEST_FAILED"),
          message: statusError.message || "The request could not be completed.",
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
