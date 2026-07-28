ALTER TABLE "CoreFpsLobby"
ADD COLUMN "modeName" TEXT NOT NULL DEFAULT 'ffa';

ALTER TABLE "CoreFpsLobbyParticipant"
ADD COLUMN "mapVote" TEXT,
ADD COLUMN "modeVote" TEXT;

CREATE INDEX "CoreFpsLobbyParticipant_lobbyId_mapVote_idx"
ON "CoreFpsLobbyParticipant"("lobbyId", "mapVote");

CREATE INDEX "CoreFpsLobbyParticipant_lobbyId_modeVote_idx"
ON "CoreFpsLobbyParticipant"("lobbyId", "modeVote");
