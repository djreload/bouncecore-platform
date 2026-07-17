CREATE TABLE "UserPerformancePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPerformancePreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPerformancePreference_userId_key" ON "UserPerformancePreference"("userId");
CREATE INDEX "UserPerformancePreference_updatedAt_idx" ON "UserPerformancePreference"("updatedAt");

ALTER TABLE "UserPerformancePreference"
ADD CONSTRAINT "UserPerformancePreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
