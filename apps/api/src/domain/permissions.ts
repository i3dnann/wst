import type { Permission } from "@mafia/shared";

export interface AuthorizationContext {
  userId: string;
  permissions: Set<Permission>;
  gangScopes: Set<string>;
}

export function canManageGang(
  context: AuthorizationContext,
  gangId: string,
): boolean {
  return (
    context.permissions.has("gang.update.any") ||
    (context.permissions.has("gang.update.own") &&
      context.gangScopes.has(gangId))
  );
}

export function can(
  context: AuthorizationContext,
  permission: Permission,
): boolean {
  return context.permissions.has(permission);
}
