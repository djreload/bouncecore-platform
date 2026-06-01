CREATE TABLE "StreamSchedule" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "hostUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StreamSchedule_channelId_idx" ON "StreamSchedule"("channelId");
CREATE INDEX "StreamSchedule_hostUserId_idx" ON "StreamSchedule"("hostUserId");
CREATE INDEX "StreamSchedule_startsAt_idx" ON "StreamSchedule"("startsAt");
CREATE INDEX "StreamSchedule_status_idx" ON "StreamSchedule"("status");

ALTER TABLE "StreamSchedule" ADD CONSTRAINT "StreamSchedule_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "StreamChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StreamSchedule" ADD CONSTRAINT "StreamSchedule_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
