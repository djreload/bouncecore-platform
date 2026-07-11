CREATE TABLE "RaveWar" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "challengerId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "levelKey" TEXT NOT NULL DEFAULT 'bazooka-battlefield',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "seed" TEXT NOT NULL,
  "turnUserId" TEXT,
  "winnerUserId" TEXT,
  "state" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RaveWar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaveWarParticipant" (
  "id" TEXT NOT NULL,
  "warId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "playerIndex" INTEGER NOT NULL,
  "displayNameSnapshot" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RaveWarParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaveWarEvent" (
  "id" TEXT NOT NULL,
  "warId" TEXT NOT NULL,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "payload" JSONB,
  "sequence" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RaveWarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RaveWar_roomId_createdAt_idx" ON "RaveWar"("roomId", "createdAt");
CREATE INDEX "RaveWar_challengerId_createdAt_idx" ON "RaveWar"("challengerId", "createdAt");
CREATE INDEX "RaveWar_targetId_createdAt_idx" ON "RaveWar"("targetId", "createdAt");
CREATE INDEX "RaveWar_status_expiresAt_idx" ON "RaveWar"("status", "expiresAt");
CREATE INDEX "RaveWar_turnUserId_idx" ON "RaveWar"("turnUserId");
CREATE INDEX "RaveWar_winnerUserId_idx" ON "RaveWar"("winnerUserId");

CREATE UNIQUE INDEX "RaveWarParticipant_warId_userId_key" ON "RaveWarParticipant"("warId", "userId");
CREATE UNIQUE INDEX "RaveWarParticipant_warId_playerIndex_key" ON "RaveWarParticipant"("warId", "playerIndex");
CREATE INDEX "RaveWarParticipant_userId_createdAt_idx" ON "RaveWarParticipant"("userId", "createdAt");

CREATE UNIQUE INDEX "RaveWarEvent_warId_sequence_key" ON "RaveWarEvent"("warId", "sequence");
CREATE INDEX "RaveWarEvent_warId_createdAt_idx" ON "RaveWarEvent"("warId", "createdAt");
CREATE INDEX "RaveWarEvent_userId_idx" ON "RaveWarEvent"("userId");
CREATE INDEX "RaveWarEvent_type_idx" ON "RaveWarEvent"("type");

ALTER TABLE "RaveWar" ADD CONSTRAINT "RaveWar_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaveWar" ADD CONSTRAINT "RaveWar_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaveWar" ADD CONSTRAINT "RaveWar_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaveWarParticipant" ADD CONSTRAINT "RaveWarParticipant_warId_fkey" FOREIGN KEY ("warId") REFERENCES "RaveWar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaveWarParticipant" ADD CONSTRAINT "RaveWarParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaveWarEvent" ADD CONSTRAINT "RaveWarEvent_warId_fkey" FOREIGN KEY ("warId") REFERENCES "RaveWar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaveWarEvent" ADD CONSTRAINT "RaveWarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
