ALTER TABLE "Order"
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundedPence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "restockedAt" TIMESTAMP(3);

ALTER TABLE "DigitalTrackPurchase"
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundedPence" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MusicCheckout"
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundedPence" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "StarPurchase"
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundedPence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "refundedStars" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Order_refundedAt_idx" ON "Order"("refundedAt");
CREATE INDEX "DigitalTrackPurchase_refundedAt_idx" ON "DigitalTrackPurchase"("refundedAt");
CREATE INDEX "MusicCheckout_refundedAt_idx" ON "MusicCheckout"("refundedAt");
CREATE INDEX "StarPurchase_refundedAt_idx" ON "StarPurchase"("refundedAt");
