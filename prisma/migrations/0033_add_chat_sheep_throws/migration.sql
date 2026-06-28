CREATE TABLE "ChatSheepThrow" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "throwerId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetDisplayName" TEXT,
  "targetMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChatSheepThrow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatSheepThrow_createdAt_idx" ON "ChatSheepThrow"("createdAt");
CREATE INDEX "ChatSheepThrow_roomId_createdAt_idx" ON "ChatSheepThrow"("roomId", "createdAt");
CREATE INDEX "ChatSheepThrow_throwerId_createdAt_idx" ON "ChatSheepThrow"("throwerId", "createdAt");
CREATE INDEX "ChatSheepThrow_targetUserId_idx" ON "ChatSheepThrow"("targetUserId");
