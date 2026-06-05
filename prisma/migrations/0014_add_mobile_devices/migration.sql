CREATE TABLE "MobileDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPreview" TEXT NOT NULL,
  "deviceName" TEXT,
  "appVersion" TEXT,
  "osVersion" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MobileDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileDevice_tokenHash_key" ON "MobileDevice"("tokenHash");
CREATE INDEX "MobileDevice_userId_idx" ON "MobileDevice"("userId");
CREATE INDEX "MobileDevice_provider_idx" ON "MobileDevice"("provider");
CREATE INDEX "MobileDevice_platform_idx" ON "MobileDevice"("platform");
CREATE INDEX "MobileDevice_lastSeenAt_idx" ON "MobileDevice"("lastSeenAt");
CREATE INDEX "MobileDevice_revokedAt_idx" ON "MobileDevice"("revokedAt");

ALTER TABLE "MobileDevice" ADD CONSTRAINT "MobileDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
