CREATE TABLE "StarPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stars" INTEGER NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "packageLabel" TEXT NOT NULL,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "paypalPayerEmail" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StarPurchase_paypalOrderId_key" ON "StarPurchase"("paypalOrderId");
CREATE INDEX "StarPurchase_userId_idx" ON "StarPurchase"("userId");
CREATE INDEX "StarPurchase_status_idx" ON "StarPurchase"("status");
CREATE INDEX "StarPurchase_createdAt_idx" ON "StarPurchase"("createdAt");

ALTER TABLE "StarPurchase" ADD CONSTRAINT "StarPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
