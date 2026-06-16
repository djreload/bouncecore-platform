CREATE TABLE "ChatStickerPack" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChatStickerPack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatSticker" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortcode" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'sticker',
  "isAnimated" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChatSticker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatReaction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reactionKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatStickerPack_slug_key" ON "ChatStickerPack"("slug");
CREATE INDEX "ChatStickerPack_status_sortOrder_idx" ON "ChatStickerPack"("status", "sortOrder");
CREATE UNIQUE INDEX "ChatSticker_shortcode_key" ON "ChatSticker"("shortcode");
CREATE INDEX "ChatSticker_packId_sortOrder_idx" ON "ChatSticker"("packId", "sortOrder");
CREATE INDEX "ChatSticker_kind_sortOrder_idx" ON "ChatSticker"("kind", "sortOrder");
CREATE UNIQUE INDEX "ChatReaction_messageId_userId_key" ON "ChatReaction"("messageId", "userId");
CREATE INDEX "ChatReaction_messageId_reactionKey_idx" ON "ChatReaction"("messageId", "reactionKey");
CREATE INDEX "ChatReaction_userId_idx" ON "ChatReaction"("userId");

ALTER TABLE "ChatSticker" ADD CONSTRAINT "ChatSticker_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ChatStickerPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
