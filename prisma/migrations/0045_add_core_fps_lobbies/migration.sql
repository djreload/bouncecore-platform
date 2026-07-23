CREATE TABLE "CoreFpsLobby" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "mapName" TEXT NOT NULL,
    "joinDeadline" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoreFpsLobby_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoreFpsLobbyParticipant" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "CoreFpsLobbyParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CoreFpsSession" ADD COLUMN "lobbyId" TEXT;

CREATE INDEX "CoreFpsLobby_roomId_status_createdAt_idx" ON "CoreFpsLobby"("roomId", "status", "createdAt");
CREATE INDEX "CoreFpsLobby_status_joinDeadline_idx" ON "CoreFpsLobby"("status", "joinDeadline");
CREATE INDEX "CoreFpsLobby_createdById_createdAt_idx" ON "CoreFpsLobby"("createdById", "createdAt");
CREATE UNIQUE INDEX "CoreFpsLobbyParticipant_lobbyId_userId_key" ON "CoreFpsLobbyParticipant"("lobbyId", "userId");
CREATE INDEX "CoreFpsLobbyParticipant_lobbyId_leftAt_lastSeenAt_idx" ON "CoreFpsLobbyParticipant"("lobbyId", "leftAt", "lastSeenAt");
CREATE INDEX "CoreFpsLobbyParticipant_userId_lastSeenAt_idx" ON "CoreFpsLobbyParticipant"("userId", "lastSeenAt");
CREATE INDEX "CoreFpsSession_lobbyId_createdAt_idx" ON "CoreFpsSession"("lobbyId", "createdAt");

ALTER TABLE "CoreFpsLobby"
ADD CONSTRAINT "CoreFpsLobby_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoreFpsLobby"
ADD CONSTRAINT "CoreFpsLobby_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoreFpsLobbyParticipant"
ADD CONSTRAINT "CoreFpsLobbyParticipant_lobbyId_fkey"
FOREIGN KEY ("lobbyId") REFERENCES "CoreFpsLobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoreFpsLobbyParticipant"
ADD CONSTRAINT "CoreFpsLobbyParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoreFpsSession"
ADD CONSTRAINT "CoreFpsSession_lobbyId_fkey"
FOREIGN KEY ("lobbyId") REFERENCES "CoreFpsLobby"("id") ON DELETE SET NULL ON UPDATE CASCADE;
