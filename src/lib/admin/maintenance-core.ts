export const clearAuditLogsConfirmationText = "CLEAR AUDIT LOGS";
export const clearNotificationInboxConfirmationText = "CLEAR NOTIFICATIONS";
export const clearNotificationLogsConfirmationText = "CLEAR NOTIFICATION LOGS";
export const clearSupportInboxConfirmationText = "CLEAR SUPPORT INBOX";
export const cancelStaleCheckoutsConfirmationText = "CANCEL STALE CHECKOUTS";
export const cleanOrphanUploadsConfirmationText = "CLEAN ORPHAN UPLOADS";
export const orphanUploadBackupAcknowledgementText = "I have exported a storage manifest or run a full uploads backup.";

export function assertMaintenanceConfirmation(input: string | null | undefined, expected: string) {
  if ((input ?? "").trim() !== expected) {
    throw new Error(`Type ${expected} to confirm this clear action.`);
  }
}

export function assertBackupAcknowledgement(input: FormDataEntryValue | boolean | null | undefined) {
  if (input !== true && input !== "on") {
    throw new Error("Confirm that you have exported a storage manifest or run a full uploads backup before cleaning orphan uploads.");
  }
}
