"use server";

import { revalidatePath } from "next/cache";
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

export async function clearNotificationsAction(formData: FormData) {
  const user = await requireSignedInUser();

  assertMaintenanceConfirmation(formString(formData, "confirmation"), clearNotificationInboxConfirmationText);
  await clearAccountNotifications(user.id);
  revalidatePath("/account");
  revalidatePath("/account/notifications");
  revalidatePath("/account/settings");
  revalidatePath("/admin/notification-logs");
}
