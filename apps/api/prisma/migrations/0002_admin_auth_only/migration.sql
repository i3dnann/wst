-- Replace third-party and game-server identities with private administrator credentials.
ALTER TABLE "User" DROP COLUMN "discordId";
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

DROP TABLE "SyncEvent";
ALTER TABLE "Player" DROP COLUMN "externalFiveMId";
DROP TYPE "SyncStatus";
