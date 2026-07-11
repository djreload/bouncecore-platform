ALTER TABLE "ChatMessage" ADD COLUMN "editedAt" TIMESTAMP(3);

CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");
