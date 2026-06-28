"use server";

import { revalidatePath } from "next/cache";
import type { AdminNotificationLogsActionState } from "@/app/admin/notification-logs/state";
import { clearAdminNotificationLogs } from "@/lib/admin/notification-log-service";
import { assertMaintenanceConfirmation, clearNotificationLogsConfirmationText } from "@/lib/admin/maintenance-core";
import { requireUserPermission } from "@/lib/auth/guards";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function clearNotificationLogsAction(
  _previousState: AdminNotificationLogsActionState,
  formData: FormData
): Promise<AdminNotificationLogsActionState> {
  try {
    const actor = await requireUserPermission("mobile.manage");

    assertMaintenanceConfirmation(formString(formData, "confirmation"), clearNotificationLogsConfirmationText);
    const result = await clearAdminNotificationLogs(actor);

    revalidatePath("/admin/notification-logs");
    revalidatePath("/admin/audit-logs");
    revalidatePath("/account/notifications");

    return {
      message: `${result.deletedNotifications.toLocaleString("en-GB")} notifications and ${result.deletedEmailEvents.toLocaleString(
        "en-GB"
      )} email events cleared.`,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Notification logs could not be cleared.",
      status: "error"
    };
  }
}
