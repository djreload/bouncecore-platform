import assert from "node:assert/strict";
import { test } from "node:test";
import {
  paidMusicDeliveryRecoveryBatchLimit,
  paidMusicDeliveryRecoveryMessage,
  repairPaidMusicDeliveryConfirmationText
} from "../src/lib/music/music-delivery-recovery-core.ts";

test("music delivery recovery exposes stable confirmation and summary text", () => {
  assert.equal(repairPaidMusicDeliveryConfirmationText, "REPAIR PAID MUSIC DELIVERY");
  assert.equal(paidMusicDeliveryRecoveryBatchLimit, 500);
  assert.equal(
    paidMusicDeliveryRecoveryMessage({
      repairedPurchases: 1,
      scannedPurchases: 1,
      skippedPurchases: 0,
      trackIds: ["track_1"]
    }),
    "1 paid music purchase delivery snapshot repaired. 0 still need track delivery URLs."
  );
  assert.equal(
    paidMusicDeliveryRecoveryMessage({
      repairedPurchases: 2,
      scannedPurchases: 2,
      skippedPurchases: 3,
      trackIds: []
    }),
    "2 paid music purchase delivery snapshots repaired. 3 still need track delivery URLs."
  );
});
