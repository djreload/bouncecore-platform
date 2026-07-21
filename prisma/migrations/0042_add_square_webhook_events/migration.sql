CREATE TABLE "SquareWebhookEvent" (
    "id" TEXT NOT NULL,
    "squareEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "squareOrderId" TEXT,
    "squarePaymentId" TEXT,
    "processingStatus" TEXT NOT NULL DEFAULT 'received',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SquareWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SquareWebhookEvent_squareEventId_key" ON "SquareWebhookEvent"("squareEventId");
CREATE INDEX "SquareWebhookEvent_eventType_idx" ON "SquareWebhookEvent"("eventType");
CREATE INDEX "SquareWebhookEvent_processingStatus_receivedAt_idx" ON "SquareWebhookEvent"("processingStatus", "receivedAt");
CREATE INDEX "SquareWebhookEvent_squareOrderId_idx" ON "SquareWebhookEvent"("squareOrderId");
CREATE INDEX "SquareWebhookEvent_squarePaymentId_idx" ON "SquareWebhookEvent"("squarePaymentId");
