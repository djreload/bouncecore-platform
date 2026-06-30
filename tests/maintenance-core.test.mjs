import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertBackupAcknowledgement,
  assertMaintenanceConfirmation,
  cancelStaleCheckoutsConfirmationText,
  cleanOrphanUploadsConfirmationText,
  clearAuditLogsConfirmationText,
  clearNotificationInboxConfirmationText,
  clearNotificationLogsConfirmationText,
  clearSupportInboxConfirmationText,
  orphanUploadBackupAcknowledgementText
} from "../src/lib/admin/maintenance-core.ts";

test("maintenance clear confirmations expose stable required phrases", () => {
  assert.equal(clearAuditLogsConfirmationText, "CLEAR AUDIT LOGS");
  assert.equal(clearNotificationInboxConfirmationText, "CLEAR NOTIFICATIONS");
  assert.equal(clearNotificationLogsConfirmationText, "CLEAR NOTIFICATION LOGS");
  assert.equal(clearSupportInboxConfirmationText, "CLEAR SUPPORT INBOX");
  assert.equal(cancelStaleCheckoutsConfirmationText, "CANCEL STALE CHECKOUTS");
  assert.equal(cleanOrphanUploadsConfirmationText, "CLEAN ORPHAN UPLOADS");
  assert.equal(orphanUploadBackupAcknowledgementText, "I have exported a storage manifest or run a full uploads backup.");
});

test("maintenance clear confirmations reject missing or mismatched input", () => {
  assert.doesNotThrow(() => assertMaintenanceConfirmation("CLEAR NOTIFICATIONS", clearNotificationInboxConfirmationText));
  assert.throws(() => assertMaintenanceConfirmation("clear notifications", clearNotificationInboxConfirmationText), /Type CLEAR NOTIFICATIONS/);
  assert.throws(() => assertMaintenanceConfirmation("", clearAuditLogsConfirmationText), /Type CLEAR AUDIT LOGS/);
});

test("orphan upload cleanup requires backup acknowledgement", () => {
  assert.doesNotThrow(() => assertBackupAcknowledgement("on"));
  assert.doesNotThrow(() => assertBackupAcknowledgement(true));
  assert.throws(() => assertBackupAcknowledgement(null), /exported a storage manifest/);
  assert.throws(() => assertBackupAcknowledgement("false"), /exported a storage manifest/);
});
