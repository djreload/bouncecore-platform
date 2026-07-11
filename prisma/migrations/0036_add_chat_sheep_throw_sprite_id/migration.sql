ALTER TABLE "ChatSheepThrow" ADD COLUMN "spriteId" TEXT NOT NULL DEFAULT 'sheep';

CREATE INDEX "ChatSheepThrow_spriteId_idx" ON "ChatSheepThrow"("spriteId");
