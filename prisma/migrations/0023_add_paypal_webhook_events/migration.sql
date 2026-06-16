CREATE TABLE "PayPalWebhookEvent" (
    "id" TEXT NOT NULL,
    "paypalEventId" TEXT NOT NULL,
    "transmissionId" TEXT,
    "eventType" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'verified',
    "processingStatus" TEXT NOT NULL DEFAULT 'recorded',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PayPalWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayPalWebhookEvent_paypalEventId_key" ON "PayPalWebhookEvent"("paypalEventId");
CREATE INDEX "PayPalWebhookEvent_eventType_idx" ON "PayPalWebhookEvent"("eventType");
CREATE INDEX "PayPalWebhookEvent_processingStatus_idx" ON "PayPalWebhookEvent"("processingStatus");
CREATE INDEX "PayPalWebhookEvent_receivedAt_idx" ON "PayPalWebhookEvent"("receivedAt");
CREATE INDEX "PayPalWebhookEvent_resourceType_resourceId_idx" ON "PayPalWebhookEvent"("resourceType", "resourceId");
