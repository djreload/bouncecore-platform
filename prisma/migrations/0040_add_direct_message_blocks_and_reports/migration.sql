CREATE TABLE "DirectMessageBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessageBlock_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChatReport" ADD COLUMN "directConversationId" TEXT;
ALTER TABLE "ChatReport" ADD COLUMN "directMessageId" TEXT;

CREATE UNIQUE INDEX "DirectMessageBlock_blockerId_blockedUserId_key" ON "DirectMessageBlock"("blockerId", "blockedUserId");
CREATE INDEX "DirectMessageBlock_blockedUserId_idx" ON "DirectMessageBlock"("blockedUserId");
CREATE INDEX "DirectMessageBlock_createdAt_idx" ON "DirectMessageBlock"("createdAt");
CREATE INDEX "ChatReport_directConversationId_idx" ON "ChatReport"("directConversationId");
CREATE INDEX "ChatReport_directMessageId_idx" ON "ChatReport"("directMessageId");

ALTER TABLE "DirectMessageBlock"
ADD CONSTRAINT "DirectMessageBlock_blockerId_fkey"
FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectMessageBlock"
ADD CONSTRAINT "DirectMessageBlock_blockedUserId_fkey"
FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatReport"
ADD CONSTRAINT "ChatReport_directConversationId_fkey"
FOREIGN KEY ("directConversationId") REFERENCES "DirectConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatReport"
ADD CONSTRAINT "ChatReport_directMessageId_fkey"
FOREIGN KEY ("directMessageId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
