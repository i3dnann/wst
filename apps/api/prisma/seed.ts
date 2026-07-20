import { PrismaClient } from "@prisma/client";
import { permissions } from "@mafia/shared";

if (process.env.NODE_ENV === "production") {
  throw new Error("Development seed is disabled in production.");
}

const prisma = new PrismaClient();

async function main() {
  for (const [name, key] of Object.entries(permissions)) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Development permission: ${name}` },
    });
  }
  await prisma.role.upsert({
    where: { name: "Public visitor" },
    update: {},
    create: {
      name: "Public visitor",
      description: "Unauthenticated public access",
    },
  });
  console.info(
    "Development-only roles and permissions seeded. No gangs, players, matches, or statistics were fabricated.",
  );
}

await main().finally(() => prisma.$disconnect());
