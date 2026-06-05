ALTER TABLE "MobilePushDelivery" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "MobilePushDelivery" ADD COLUMN "sentAt" TIMESTAMP(3);

CREATE INDEX "MobilePushDelivery_providerMessageId_idx" ON "MobilePushDelivery"("providerMessageId");
CREATE INDEX "MobilePushDelivery_sentAt_idx" ON "MobilePushDelivery"("sentAt");
