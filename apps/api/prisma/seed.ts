import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";
import { synchronizePermissionCatalog } from "../src/lib/permission-catalog.js";

const prisma = new PrismaClient();

async function main() {
  const { role } = await synchronizePermissionCatalog(prisma);

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
