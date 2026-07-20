import type { FastifyRequest } from "fastify";
import type { Permission } from "@mafia/shared";
import { HttpError } from "../lib/http-error.js";

export function requireAuth(
  request: FastifyRequest,
): NonNullable<FastifyRequest["auth"]> {
  if (!request.auth)
    throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  return request.auth;
}

export function requirePermission(
  request: FastifyRequest,
  permission: Permission,
): NonNullable<FastifyRequest["auth"]> {
  const auth = requireAuth(request);
  if (!auth.permissions.has(permission))
    throw new HttpError(
      403,
      "PERMISSION_DENIED",
      "You do not have permission for this action.",
    );
  return auth;
}

export function requireGangScope(
  request: FastifyRequest,
  gangId: string,
): NonNullable<FastifyRequest["auth"]> {
  const auth = requireAuth(request);
  if (
    !auth.permissions.has("gang.update.any") &&
    !(auth.permissions.has("gang.update.own") && auth.gangScopes.has(gangId))
  ) {
    throw new HttpError(
      403,
      "GANG_SCOPE_DENIED",
      "You cannot manage this gang.",
    );
  }
  return auth;
}
