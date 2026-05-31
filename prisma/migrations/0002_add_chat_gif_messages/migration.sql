ALTER TABLE "ChatMessage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "ChatMessage" ADD COLUMN "mediaUrl" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "mediaPreviewUrl" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "mediaAlt" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "mediaSource" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "mediaSourceId" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "mediaWidth" INTEGER;
ALTER TABLE "ChatMessage" ADD COLUMN "mediaHeight" INTEGER;
