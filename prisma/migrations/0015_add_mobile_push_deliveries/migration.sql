ALTER TABLE "MobileDevice" ADD COLUMN "tokenCiphertext" TEXT;

CREATE TABLE "MobilePushDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "mobileDeviceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attemptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MobilePushDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MobileDevice_tokenCiphertext_idx" ON "MobileDevice"("tokenCiphertext");
CREATE INDEX "MobilePushDelivery_notificationId_idx" ON "MobilePushDelivery"("notificationId");
CREATE INDEX "MobilePushDelivery_mobileDeviceId_idx" ON "MobilePushDelivery"("mobileDeviceId");
CREATE INDEX "MobilePushDelivery_provider_idx" ON "MobilePushDelivery"("provider");
CREATE INDEX "MobilePushDelivery_platform_idx" ON "MobilePushDelivery"("platform");
CREATE INDEX "MobilePushDelivery_status_idx" ON "MobilePushDelivery"("status");
CREATE INDEX "MobilePushDelivery_createdAt_idx" ON "MobilePushDelivery"("createdAt");

ALTER TABLE "MobilePushDelivery" ADD CONSTRAINT "MobilePushDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobilePushDelivery" ADD CONSTRAINT "MobilePushDelivery_mobileDeviceId_fkey" FOREIGN KEY ("mobileDeviceId") REFERENCES "MobileDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
