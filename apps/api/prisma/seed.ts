import { PrismaClient } from "@prisma/client";
import { permissions } from "@mafia/shared";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

async function main() {
  const permissionRecords = [];
  for (const [name, key] of Object.entries(permissions)) {
    permissionRecords.push(
      await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: `World Star permission: ${name}` },
      }),
    );
  }

  const role = await prisma.role.upsert({
    where: { name: "Super Administrator" },
    update: { description: "Full manual control of published World Star data" },
    create: {
      name: "Super Administrator",
      description: "Full manual control of published World Star data",
    },
  });

  for (const permission of permissionRecords) {
    await prisma.rolePermission.upsert({
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

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      "Permissions were seeded. Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first administrator.",
    );
    return;
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  }

  const passwordHash = await hashPassword(password);
  const administrator = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, status: "ACTIVE" },
    create: {
      email,
      passwordHash,
      username: email.split("@")[0] ?? "administrator",
      displayName: "Administrator",
      status: "ACTIVE",
    },
  });
  const assignment = await prisma.userRole.findFirst({
    where: { userId: administrator.id, roleId: role.id, gangId: null },
  });
  if (!assignment) {
    await prisma.userRole.create({
      data: { userId: administrator.id, roleId: role.id },
    });
  }

  console.info(`Administrator ready: ${email}`);
}

await main().finally(() => prisma.$disconnect());
