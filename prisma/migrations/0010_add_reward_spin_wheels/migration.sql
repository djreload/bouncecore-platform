-- CreateTable
CREATE TABLE "RewardSpinWheel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "costStars" INTEGER NOT NULL DEFAULT 0,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 1440,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardSpinWheel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardSpinWheelSegment" (
    "id" TEXT NOT NULL,
    "wheelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prizeType" TEXT NOT NULL DEFAULT 'none',
    "prizeValue" TEXT,
    "starAmount" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardSpinWheelSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wheelId" TEXT,
    "segmentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prizeType" TEXT NOT NULL DEFAULT 'manual',
    "prizeValue" TEXT,
    "starAmount" INTEGER NOT NULL DEFAULT 0,
    "fulfilmentNote" TEXT,
    "starsCreditedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardSpinWheel_slug_key" ON "RewardSpinWheel"("slug");

-- CreateIndex
CREATE INDEX "RewardSpinWheel_status_idx" ON "RewardSpinWheel"("status");

-- CreateIndex
CREATE INDEX "RewardSpinWheel_createdAt_idx" ON "RewardSpinWheel"("createdAt");

-- CreateIndex
CREATE INDEX "RewardSpinWheelSegment_wheelId_idx" ON "RewardSpinWheelSegment"("wheelId");

-- CreateIndex
CREATE INDEX "RewardSpinWheelSegment_status_idx" ON "RewardSpinWheelSegment"("status");

-- CreateIndex
CREATE INDEX "PrizeClaim_userId_idx" ON "PrizeClaim"("userId");

-- CreateIndex
CREATE INDEX "PrizeClaim_wheelId_idx" ON "PrizeClaim"("wheelId");

-- CreateIndex
CREATE INDEX "PrizeClaim_segmentId_idx" ON "PrizeClaim"("segmentId");

-- CreateIndex
CREATE INDEX "PrizeClaim_status_idx" ON "PrizeClaim"("status");

-- CreateIndex
CREATE INDEX "PrizeClaim_createdAt_idx" ON "PrizeClaim"("createdAt");

-- AddForeignKey
ALTER TABLE "RewardSpinWheelSegment" ADD CONSTRAINT "RewardSpinWheelSegment_wheelId_fkey" FOREIGN KEY ("wheelId") REFERENCES "RewardSpinWheel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeClaim" ADD CONSTRAINT "PrizeClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeClaim" ADD CONSTRAINT "PrizeClaim_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeClaim" ADD CONSTRAINT "PrizeClaim_wheelId_fkey" FOREIGN KEY ("wheelId") REFERENCES "RewardSpinWheel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeClaim" ADD CONSTRAINT "PrizeClaim_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "RewardSpinWheelSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
