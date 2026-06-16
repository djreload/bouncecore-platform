-- Add room-level chat moderation controls.
ALTER TABLE "ChatRoom" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "ChatRoom" ADD COLUMN "slowModeSeconds" INTEGER NOT NULL DEFAULT 0;
