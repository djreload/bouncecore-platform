ALTER TABLE "MobilePushDelivery" ADD COLUMN "receiptStatus" TEXT;
ALTER TABLE "MobilePushDelivery" ADD COLUMN "receiptCheckedAt" TIMESTAMP(3);
ALTER TABLE "MobilePushDelivery" ADD COLUMN "providerReceipt" JSONB;

CREATE INDEX "MobilePushDelivery_receiptStatus_idx" ON "MobilePushDelivery"("receiptStatus");
CREATE INDEX "MobilePushDelivery_receiptCheckedAt_idx" ON "MobilePushDelivery"("receiptCheckedAt");
