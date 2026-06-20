ALTER TABLE "RewardSpinWheelSegment" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered_segments AS (
  SELECT
    "id",
    (ROW_NUMBER() OVER (
      PARTITION BY "wheelId"
      ORDER BY "createdAt" ASC, "label" ASC, "id" ASC
    ) - 1) * 10 AS "computedSortOrder"
  FROM "RewardSpinWheelSegment"
)
UPDATE "RewardSpinWheelSegment"
SET "sortOrder" = ordered_segments."computedSortOrder"
FROM ordered_segments
WHERE "RewardSpinWheelSegment"."id" = ordered_segments."id";

CREATE INDEX "RewardSpinWheelSegment_wheelId_sortOrder_idx" ON "RewardSpinWheelSegment"("wheelId", "sortOrder");
