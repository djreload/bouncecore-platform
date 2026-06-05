-- AlterTable
ALTER TABLE "DigitalTrack" ADD COLUMN "previewUrl" TEXT,
ADD COLUMN "downloadUrl" TEXT,
ADD COLUMN "licenseType" TEXT NOT NULL DEFAULT 'personal',
ADD COLUMN "licenseSummary" TEXT;

-- AlterTable
ALTER TABLE "DigitalTrackPurchase" ADD COLUMN "downloadUrl" TEXT,
ADD COLUMN "licenseType" TEXT NOT NULL DEFAULT 'personal',
ADD COLUMN "licenseSummary" TEXT,
ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastDownloadedAt" TIMESTAMP(3);
