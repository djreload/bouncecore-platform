"use server";

import { revalidatePath } from "next/cache";
import { clearAdminNotificationLogs } from "@/lib/admin/notification-log-service";
import { assertMaintenanceConfirmation, clearNotificationLogsConfirmationText } from "@/lib/admin/maintenance-core";
import { requireUserPermission } from "@/lib/auth/guards";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function clearNotificationLogsAction(formData: FormData) {
  const actor = await requireUserPermission("mobile.manage");

  assertMaintenanceConfirmation(formString(formData, "confirmation"), clearNotificationLogsConfirmationText);
  await clearAdminNotificationLogs(actor);

  revalidatePath("/admin/notification-logs");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/account/notifications");
}
