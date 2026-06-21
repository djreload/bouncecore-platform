import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertMaintenanceConfirmation,
  clearAuditLogsConfirmationText,
  clearNotificationInboxConfirmationText,
  clearNotificationLogsConfirmationText,
  clearSupportInboxConfirmationText
} from "../src/lib/admin/maintenance-core.ts";

test("maintenance clear confirmations expose stable required phrases", () => {
  assert.equal(clearAuditLogsConfirmationText, "CLEAR AUDIT LOGS");
  assert.equal(clearNotificationInboxConfirmationText, "CLEAR NOTIFICATIONS");
  assert.equal(clearNotificationLogsConfirmationText, "CLEAR NOTIFICATION LOGS");
  assert.equal(clearSupportInboxConfirmationText, "CLEAR SUPPORT INBOX");
});

test("maintenance clear confirmations reject missing or mismatched input", () => {
  assert.doesNotThrow(() => assertMaintenanceConfirmation("CLEAR NOTIFICATIONS", clearNotificationInboxConfirmationText));
  assert.throws(() => assertMaintenanceConfirmation("clear notifications", clearNotificationInboxConfirmationText), /Type CLEAR NOTIFICATIONS/);
  assert.throws(() => assertMaintenanceConfirmation("", clearAuditLogsConfirmationText), /Type CLEAR AUDIT LOGS/);
});
