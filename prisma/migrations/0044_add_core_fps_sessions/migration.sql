CREATE TABLE "CoreFpsSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayNameSnapshot" TEXT NOT NULL,
    "runtimePlayerName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'launched',
    "score" INTEGER NOT NULL DEFAULT 0,
    "frags" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "damage" INTEGER NOT NULL DEFAULT 0,
    "teamKills" INTEGER NOT NULL DEFAULT 0,
    "flags" INTEGER NOT NULL DEFAULT 0,
    "lastFrags" INTEGER NOT NULL DEFAULT 0,
    "lastDeaths" INTEGER NOT NULL DEFAULT 0,
    "lastDamage" INTEGER NOT NULL DEFAULT 0,
    "lastTeamKills" INTEGER NOT NULL DEFAULT 0,
    "lastFlags" INTEGER NOT NULL DEFAULT 0,
    "mapName" TEXT,
    "modeName" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoreFpsSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoreFpsSession_runtimePlayerName_key" ON "CoreFpsSession"("runtimePlayerName");
CREATE INDEX "CoreFpsSession_userId_createdAt_idx" ON "CoreFpsSession"("userId", "createdAt");
CREATE INDEX "CoreFpsSession_status_lastSeenAt_idx" ON "CoreFpsSession"("status", "lastSeenAt");
CREATE INDEX "CoreFpsSession_score_createdAt_idx" ON "CoreFpsSession"("score", "createdAt");

ALTER TABLE "CoreFpsSession"
ADD CONSTRAINT "CoreFpsSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
