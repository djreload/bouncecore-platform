export const clearAuditLogsConfirmationText = "CLEAR AUDIT LOGS";
export const clearNotificationInboxConfirmationText = "CLEAR NOTIFICATIONS";
export const clearNotificationLogsConfirmationText = "CLEAR NOTIFICATION LOGS";
export const clearSupportInboxConfirmationText = "CLEAR SUPPORT INBOX";

export function assertMaintenanceConfirmation(input: string | null | undefined, expected: string) {
  if ((input ?? "").trim() !== expected) {
    throw new Error(`Type ${expected} to confirm this clear action.`);
  }
}
