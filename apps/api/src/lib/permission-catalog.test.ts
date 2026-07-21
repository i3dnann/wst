import { describe, expect, it, vi } from "vitest";
import { permissions } from "@mafia/shared";
import type { PrismaClient } from "@prisma/client";
import { synchronizePermissionCatalog } from "./permission-catalog.js";

describe("synchronizePermissionCatalog", () => {
  it("grants every current permission to the protected super administrator", async () => {
    let permissionIndex = 0;
    const permissionUpsert = vi.fn(({ where }: { where: { key: string } }) =>
      Promise.resolve({
        id: `permission-${String(++permissionIndex)}`,
        key: where.key,
      }),
    );
    const rolePermissionUpsert = vi.fn(() => Promise.resolve({}));
    const database = {
      permission: { upsert: permissionUpsert },
      role: {
        upsert: vi.fn(() =>
          Promise.resolve({
            id: "super-role",
            name: "Super Administrator",
            status: "ACTIVE",
          }),
        ),
      },
      rolePermission: { upsert: rolePermissionUpsert },
    } as unknown as PrismaClient;

    const result = await synchronizePermissionCatalog(database);

    expect(result.permissionCount).toBe(Object.keys(permissions).length);
    expect(permissionUpsert).toHaveBeenCalledTimes(
      Object.keys(permissions).length,
    );
    expect(rolePermissionUpsert).toHaveBeenCalledTimes(
      Object.keys(permissions).length,
    );
    expect(result.role.id).toBe("super-role");
  });
});
