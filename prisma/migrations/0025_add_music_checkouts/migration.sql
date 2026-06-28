CREATE TABLE "MusicCheckout" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "paypalPayerEmail" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicCheckout_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DigitalTrackPurchase" ADD COLUMN "checkoutId" TEXT;

CREATE UNIQUE INDEX "MusicCheckout_paypalOrderId_key" ON "MusicCheckout"("paypalOrderId");
CREATE INDEX "MusicCheckout_buyerId_idx" ON "MusicCheckout"("buyerId");
CREATE INDEX "MusicCheckout_status_idx" ON "MusicCheckout"("status");
CREATE INDEX "MusicCheckout_createdAt_idx" ON "MusicCheckout"("createdAt");
CREATE INDEX "DigitalTrackPurchase_checkoutId_idx" ON "DigitalTrackPurchase"("checkoutId");

ALTER TABLE "MusicCheckout" ADD CONSTRAINT "MusicCheckout_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalTrackPurchase" ADD CONSTRAINT "DigitalTrackPurchase_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MusicCheckout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
