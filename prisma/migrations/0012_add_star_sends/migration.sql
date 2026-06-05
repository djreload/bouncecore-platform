-- CreateTable
CREATE TABLE "StarSend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "messageId" TEXT,
    "streamSessionId" TEXT,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StarSend_messageId_key" ON "StarSend"("messageId");

-- CreateIndex
CREATE INDEX "StarSend_userId_idx" ON "StarSend"("userId");

-- CreateIndex
CREATE INDEX "StarSend_roomId_idx" ON "StarSend"("roomId");

-- CreateIndex
CREATE INDEX "StarSend_streamSessionId_idx" ON "StarSend"("streamSessionId");

-- CreateIndex
CREATE INDEX "StarSend_createdAt_idx" ON "StarSend"("createdAt");

-- AddForeignKey
ALTER TABLE "StarSend" ADD CONSTRAINT "StarSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarSend" ADD CONSTRAINT "StarSend_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarSend" ADD CONSTRAINT "StarSend_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarSend" ADD CONSTRAINT "StarSend_streamSessionId_fkey" FOREIGN KEY ("streamSessionId") REFERENCES "StreamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
