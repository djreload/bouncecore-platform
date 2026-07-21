export const raveWarAdminRepairReasonMaxLength = 240;
export const raveWarAdminRepairReasonMinLength = 5;

export type RaveWarAdminRepairAction = "force-end" | "refund-entry" | "resync";

export function raveWarAdminRepairConfirmationText(action: RaveWarAdminRepairAction, warId: string) {
  const command = action === "force-end" ? "FORCE END" : action === "refund-entry" ? "REFUND" : "RESYNC";

  return `${command} ${warId.trim()}`;
}

export function normalizeRaveWarAdminRepairReason(value: unknown) {
  const reason = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

  if (reason.length < raveWarAdminRepairReasonMinLength) {
    throw new Error(`Enter an operational reason of at least ${raveWarAdminRepairReasonMinLength} characters.`);
  }

  if (reason.length > raveWarAdminRepairReasonMaxLength) {
    throw new Error(`Operational reason must be ${raveWarAdminRepairReasonMaxLength} characters or fewer.`);
  }

  return reason;
}

export function assertRaveWarAdminRepairConfirmation(
  action: RaveWarAdminRepairAction,
  warId: string,
  confirmation: unknown
) {
  const expected = raveWarAdminRepairConfirmationText(action, warId);

  if (typeof confirmation !== "string" || confirmation.trim() !== expected) {
    throw new Error(`Type ${expected} exactly to confirm.`);
  }
}
