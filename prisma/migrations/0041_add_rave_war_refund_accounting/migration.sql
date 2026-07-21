ALTER TABLE "RaveWar"
ADD COLUMN "entryStars" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "entryStarsChargedAt" TIMESTAMP(3),
ADD COLUMN "entryStarsRefundedAt" TIMESTAMP(3),
ADD COLUMN "entryStarsRefundReason" TEXT,
ADD COLUMN "entryStarsRefundedById" TEXT,
ADD COLUMN "terminationReason" TEXT;

-- Preserve accounting for paid pending challenges created before this migration.
UPDATE "RaveWar"
SET
  "entryStars" = CASE
    WHEN ("state"->>'challengeCostStars') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN FLOOR(("state"->>'challengeCostStars')::numeric)::integer
    ELSE 0
  END,
  "entryStarsChargedAt" = CASE
    WHEN ("state"->>'challengeCostStars') ~ '^[1-9][0-9]*(\.[0-9]+)?$'
      THEN "createdAt"
    ELSE NULL
  END;

CREATE INDEX "RaveWar_entryStarsRefundedAt_idx" ON "RaveWar"("entryStarsRefundedAt");
