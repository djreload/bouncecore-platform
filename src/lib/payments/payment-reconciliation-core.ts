import { cancelStaleCheckoutsConfirmationText } from "@/lib/admin/maintenance-core";

export const stalePendingCleanupDefaultHours = 24;
export const stalePendingCleanupMaxHours = 168;
export { cancelStaleCheckoutsConfirmationText };

export function normalizeStalePendingCleanupHours(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number((value ?? "").toString().trim() || stalePendingCleanupDefaultHours);

  if (!Number.isInteger(numeric) || numeric < 1 || numeric > stalePendingCleanupMaxHours) {
    throw new Error(`Cleanup age must be a whole number between 1 and ${stalePendingCleanupMaxHours} hours.`);
  }

  return numeric;
}
