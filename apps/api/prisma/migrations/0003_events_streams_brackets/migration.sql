CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "StreamStatus" AS ENUM ('SCHEDULED', 'LIVE', 'OFFLINE', 'ARCHIVED');
CREATE TYPE "StreamPlatform" AS ENUM ('TWITCH', 'YOUTUBE', 'KICK', 'OTHER');

ALTER TABLE "Match" ADD COLUMN "position" INTEGER;
CREATE UNIQUE INDEX "Match_bracketRoundId_position_key" ON "Match"("bracketRoundId", "position");

CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "location" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveStream" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "streamerName" TEXT NOT NULL,
  "platform" "StreamPlatform" NOT NULL,
  "channelUrl" TEXT NOT NULL,
  "embedUrl" TEXT,
  "thumbnailUrl" TEXT,
  "status" "StreamStatus" NOT NULL DEFAULT 'OFFLINE',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "tournamentId" TEXT,
  "startsAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");
CREATE INDEX "Event_featured_startsAt_idx" ON "Event"("featured", "startsAt");
CREATE UNIQUE INDEX "LiveStream_slug_key" ON "LiveStream"("slug");
CREATE INDEX "LiveStream_status_featured_updatedAt_idx" ON "LiveStream"("status", "featured", "updatedAt");
CREATE INDEX "LiveStream_tournamentId_idx" ON "LiveStream"("tournamentId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
