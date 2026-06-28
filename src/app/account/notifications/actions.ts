"use server";

import { revalidatePath } from "next/cache";
import type { AccountNotificationsActionState } from "@/app/account/notifications/state";
import {
  assertMaintenanceConfirmation,
  clearNotificationInboxConfirmationText
} from "@/lib/admin/maintenance-core";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  clearAccountNotifications,
  markAccountNotificationRead,
  markAllAccountNotificationsRead
} from "@/lib/account/account-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireSignedInUser();

  await markAccountNotificationRead(user.id, formString(formData, "notificationId"));
  revalidatePath("/account");
  revalidatePath("/account/notifications");
  revalidatePath("/account/settings");
}

export async function markAllNotificationsReadAction() {
  const user = await requireSignedInUser();

  await markAllAccountNotificationsRead(user.id);
  revalidatePath("/account");
  revalidatePath("/account/notifications");
  revalidatePath("/account/settings");
}

export async function clearNotificationsAction(
  _previousState: AccountNotificationsActionState,
  formData: FormData
): Promise<AccountNotificationsActionState> {
  try {
    const user = await requireSignedInUser();

    assertMaintenanceConfirmation(formString(formData, "confirmation"), clearNotificationInboxConfirmationText);
    const result = await clearAccountNotifications(user.id);

    revalidatePath("/account");
    revalidatePath("/account/notifications");
    revalidatePath("/account/settings");
    revalidatePath("/admin/notification-logs");

    return {
      message: `${result.count.toLocaleString("en-GB")} notifications cleared.`,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Notification inbox could not be cleared.",
      status: "error"
    };
  }
}
