import { permissions, type Permission } from "@mafia/shared";
import { HttpError } from "./http-error.js";

const knownPermissionKeys = new Set<string>(Object.values(permissions));

export interface CurrentAuthorizationRecord {
  status: string;
  roles: Array<{
    gangId: string | null;
    role: {
      permissions: Array<{
        permission: { key: string };
      }>;
    };
  }>;
}

export interface CurrentAuthorization {
  userId: string;
  permissions: Set<Permission>;
  gangScopes: Set<string>;
}

export function currentAuthorization(
  userId: string,
  user: CurrentAuthorizationRecord | null,
): CurrentAuthorization | null {
  if (!user || user.status !== "ACTIVE") return null;

  const granted = new Set<Permission>();
  const gangScopes = new Set<string>();
  for (const assignment of user.roles) {
    if (assignment.gangId) gangScopes.add(assignment.gangId);
    for (const relation of assignment.role.permissions) {
      const key = relation.permission.key;
      if (knownPermissionKeys.has(key)) granted.add(key as Permission);
    }
  }

  return { userId, permissions: granted, gangScopes };
}

export function missingPermissions(
  granted: Iterable<string>,
  requested: Iterable<string>,
): string[] {
  const available = new Set(granted);
  return [...new Set(requested)].filter((key) => !available.has(key));
}

export function assertPermissionSuperset(
  granted: Iterable<string>,
  requested: Iterable<string>,
): void {
  const missing = missingPermissions(granted, requested);
  if (!missing.length) return;
  throw new HttpError(
    403,
    "PRIVILEGE_ESCALATION_DENIED",
    "You cannot grant or manage permissions that your account does not have.",
  );
}
