import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  assertRaveWarAdminRepairConfirmation,
  normalizeRaveWarAdminRepairReason,
  raveWarAdminRepairConfirmationText
} from "../src/lib/rave-wars/rave-war-admin-repair-core.ts";

test("Rave War admin repairs require exact match-scoped confirmations", () => {
  const warId = "cmwar123456";

  assert.equal(raveWarAdminRepairConfirmationText("resync", warId), "RESYNC cmwar123456");
  assert.equal(raveWarAdminRepairConfirmationText("force-end", warId), "FORCE END cmwar123456");
  assert.equal(raveWarAdminRepairConfirmationText("refund-entry", warId), "REFUND cmwar123456");
  assert.doesNotThrow(() => assertRaveWarAdminRepairConfirmation("resync", warId, "RESYNC cmwar123456"));
  assert.throws(
    () => assertRaveWarAdminRepairConfirmation("force-end", warId, "FORCE END"),
    /Type FORCE END cmwar123456 exactly/
  );
});

test("Rave War admin repair reasons are normalized and bounded", () => {
  assert.equal(normalizeRaveWarAdminRepairReason("  clients   stopped receiving updates  "), "clients stopped receiving updates");
  assert.throws(() => normalizeRaveWarAdminRepairReason("bad"), /at least 5 characters/);
  assert.throws(() => normalizeRaveWarAdminRepairReason("x".repeat(241)), /240 characters or fewer/);
});

test("Rave War admin repair actions are protected, guarded, audited, and realtime", () => {
  const action = readFileSync(join(process.cwd(), "src/app/admin/rave-wars/actions.ts"), "utf8");
  const controls = readFileSync(join(process.cwd(), "src/app/admin/rave-wars/rave-war-repair-controls.tsx"), "utf8");
  const page = readFileSync(join(process.cwd(), "src/app/admin/rave-wars/[warId]/page.tsx"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/rave-wars/rave-war-admin-service.ts"), "utf8");

  assert.match(action, /requireUserPermission\("settings\.manage"\)/);
  assert.match(action, /assertRaveWarAdminRepairConfirmation/);
  assert.match(action, /normalizeRaveWarAdminRepairReason/);
  assert.match(action, /resyncAdminRaveWar/);
  assert.match(action, /forceEndAdminRaveWar/);
  assert.match(action, /revalidatePath\("\/admin\/audit-logs"\)/);

  assert.match(service, /raveWarMatchIsStalled/);
  assert.match(service, /status: "active",\s*updatedAt: war\.updatedAt/);
  assert.match(service, /updatedAt: war\.updatedAt/);
  assert.match(service, /type: "admin\.resynced"/);
  assert.match(service, /type: "admin\.force-ended"/);
  assert.match(service, /action: "chat\.rave_war\.admin\.resync"/);
  assert.match(service, /action: "chat\.rave_war\.admin\.force_end"/);
  assert.match(service, /publishRaveWarChanged/);
  assert.match(service, /publishChatRoomChanged/);
  assert.match(service, /The match deadline has passed\. Force end this match instead of extending it\./);

  assert.match(controls, /status === "active" && stalled/);
  assert.match(controls, /status === "active" \|\| status === "pending"/);
  assert.match(controls, /Operational reason/);
  assert.match(controls, /Exact confirmation/);
  assert.match(controls, /Available only after 150 seconds without server activity/);
  assert.match(page, /<RaveWarRepairControls[\s\S]*entryStars=\{match\.entryStars\}[\s\S]*entryStarsRefundedAt=\{match\.entryStarsRefundedAt\}[\s\S]*stalled=\{match\.stalled\}/);
  assert.match(controls, /Refund entry stars/);
  assert.match(action, /refundRaveWarEntryStarsByAdmin/);
});
