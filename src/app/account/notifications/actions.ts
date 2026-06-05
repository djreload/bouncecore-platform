"use server";

import { revalidatePath } from "next/cache";
import { requireSignedInUser } from "@/lib/auth/guards";
import { markAccountNotificationRead, markAllAccountNotificationsRead } from "@/lib/account/account-service";

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
