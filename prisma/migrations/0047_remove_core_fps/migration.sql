DELETE FROM "ChatMessage" WHERE "kind" = 'core-fps';
DELETE FROM "AppSetting" WHERE "key" = 'games.core-fps';

DROP TABLE IF EXISTS "CoreFpsLobbyParticipant";
DROP TABLE IF EXISTS "CoreFpsSession";
DROP TABLE IF EXISTS "CoreFpsLobby";
