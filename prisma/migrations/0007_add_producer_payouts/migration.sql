-- AlterTable
ALTER TABLE "ProducerProfile" ADD COLUMN "paypalPayoutEmail" TEXT;

-- CreateTable
CREATE TABLE "ProducerPayoutBatch" (
    "id" TEXT NOT NULL,
    "senderBatchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "totalPence" INTEGER NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "paypalPayoutBatchId" TEXT,
    "paypalBatchStatus" TEXT,
    "paypalResponse" JSONB,
    "errorMessage" TEXT,
    "requestedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducerPayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProducerPayoutItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "senderItemId" TEXT NOT NULL,
    "paypalPayoutItemId" TEXT,
    "paypalTransactionId" TEXT,
    "paypalTransactionStatus" TEXT,
    "paypalFeePence" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducerPayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProducerPayoutBatch_senderBatchId_key" ON "ProducerPayoutBatch"("senderBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ProducerPayoutBatch_paypalPayoutBatchId_key" ON "ProducerPayoutBatch"("paypalPayoutBatchId");

-- CreateIndex
CREATE INDEX "ProducerPayoutBatch_status_idx" ON "ProducerPayoutBatch"("status");

-- CreateIndex
CREATE INDEX "ProducerPayoutBatch_requestedById_idx" ON "ProducerPayoutBatch"("requestedById");

-- CreateIndex
CREATE INDEX "ProducerPayoutBatch_createdAt_idx" ON "ProducerPayoutBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProducerPayoutItem_senderItemId_key" ON "ProducerPayoutItem"("senderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProducerPayoutItem_paypalPayoutItemId_key" ON "ProducerPayoutItem"("paypalPayoutItemId");

-- CreateIndex
CREATE INDEX "ProducerPayoutItem_batchId_idx" ON "ProducerPayoutItem"("batchId");

-- CreateIndex
CREATE INDEX "ProducerPayoutItem_purchaseId_idx" ON "ProducerPayoutItem"("purchaseId");

-- CreateIndex
CREATE INDEX "ProducerPayoutItem_producerId_idx" ON "ProducerPayoutItem"("producerId");

-- CreateIndex
CREATE INDEX "ProducerPayoutItem_status_idx" ON "ProducerPayoutItem"("status");

-- CreateIndex
CREATE INDEX "ProducerPayoutItem_createdAt_idx" ON "ProducerPayoutItem"("createdAt");

-- AddForeignKey
ALTER TABLE "ProducerPayoutBatch" ADD CONSTRAINT "ProducerPayoutBatch_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducerPayoutItem" ADD CONSTRAINT "ProducerPayoutItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProducerPayoutBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducerPayoutItem" ADD CONSTRAINT "ProducerPayoutItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "DigitalTrackPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducerPayoutItem" ADD CONSTRAINT "ProducerPayoutItem_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "ProducerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
