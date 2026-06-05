-- Add stream profiles for OBS/transcoding guidance and future stream-core renditions.
CREATE TABLE "StreamProfile" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "videoWidth" INTEGER NOT NULL,
    "videoHeight" INTEGER NOT NULL,
    "videoBitrateKbps" INTEGER NOT NULL,
    "audioBitrateKbps" INTEGER NOT NULL,
    "fps" INTEGER NOT NULL,
    "keyframeSeconds" INTEGER NOT NULL DEFAULT 2,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StreamChannel" ADD COLUMN "streamProfileId" TEXT;

CREATE UNIQUE INDEX "StreamProfile_key_key" ON "StreamProfile"("key");
CREATE INDEX "StreamProfile_isEnabled_sortOrder_idx" ON "StreamProfile"("isEnabled", "sortOrder");
CREATE INDEX "StreamChannel_streamProfileId_idx" ON "StreamChannel"("streamProfileId");
CREATE INDEX "StreamKey_channelId_status_idx" ON "StreamKey"("channelId", "status");
CREATE INDEX "StreamKey_keyHash_idx" ON "StreamKey"("keyHash");
CREATE INDEX "StreamKey_userId_status_idx" ON "StreamKey"("userId", "status");

ALTER TABLE "StreamChannel" ADD CONSTRAINT "StreamChannel_streamProfileId_fkey" FOREIGN KEY ("streamProfileId") REFERENCES "StreamProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
