import { permissions } from "@mafia/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

type PermissionDatabase = PrismaClient | Prisma.TransactionClient;

export async function synchronizePermissionCatalog(
  database: PermissionDatabase,
) {
  const permissionRecords = [];
  for (const [name, key] of Object.entries(permissions)) {
    permissionRecords.push(
      await database.permission.upsert({
        where: { key },
        update: { description: `World Star permission: ${name}` },
        create: { key, description: `World Star permission: ${name}` },
      }),
    );
  }

  const role = await database.role.upsert({
    where: { name: "Super Administrator" },
    update: {
      description: "Full manual control of published World Star data",
      status: "ACTIVE",
    },
    create: {
      name: "Super Administrator",
      description: "Full manual control of published World Star data",
      status: "ACTIVE",
    },
  });

  for (const permission of permissionRecords) {
    await database.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }

  return { role, permissionCount: permissionRecords.length };
}
