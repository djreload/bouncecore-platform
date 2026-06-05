CREATE TABLE "DigitalTrackPurchase" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "trackTitle" TEXT NOT NULL,
    "producerName" TEXT NOT NULL,
    "pricePence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "platformFeePence" INTEGER NOT NULL DEFAULT 0,
    "producerEarningsPence" INTEGER NOT NULL,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "paypalPayerEmail" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalTrackPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DigitalTrackPurchase_paypalOrderId_key" ON "DigitalTrackPurchase"("paypalOrderId");
CREATE INDEX "DigitalTrackPurchase_buyerId_idx" ON "DigitalTrackPurchase"("buyerId");
CREATE INDEX "DigitalTrackPurchase_trackId_idx" ON "DigitalTrackPurchase"("trackId");
CREATE INDEX "DigitalTrackPurchase_producerId_idx" ON "DigitalTrackPurchase"("producerId");
CREATE INDEX "DigitalTrackPurchase_status_idx" ON "DigitalTrackPurchase"("status");
CREATE INDEX "DigitalTrackPurchase_createdAt_idx" ON "DigitalTrackPurchase"("createdAt");

ALTER TABLE "DigitalTrackPurchase" ADD CONSTRAINT "DigitalTrackPurchase_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalTrackPurchase" ADD CONSTRAINT "DigitalTrackPurchase_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "DigitalTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalTrackPurchase" ADD CONSTRAINT "DigitalTrackPurchase_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "ProducerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
