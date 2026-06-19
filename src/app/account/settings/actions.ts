"use server";

import { revalidatePath } from "next/cache";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  notificationPreferenceCategories,
  type NotificationPreferences
} from "@/lib/account/notification-preferences-core";
import { updateUserNotificationPreferences } from "@/lib/account/notification-preferences-service";
import type { NotificationPreferencesActionState } from "@/app/account/settings/state";

function checkboxEnabled(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function preferencesFromForm(formData: FormData): NotificationPreferences {
  return notificationPreferenceCategories.reduce((preferences, category) => {
    preferences[category.key] = {
      email: checkboxEnabled(formData, `${category.key}:email`),
      push: checkboxEnabled(formData, `${category.key}:push`)
    };

    return preferences;
  }, {} as NotificationPreferences);
}

export async function updateNotificationPreferencesAction(
  _previousState: NotificationPreferencesActionState,
  formData: FormData
): Promise<NotificationPreferencesActionState> {
  const actor = await requireSignedInUser();

  try {
    await updateUserNotificationPreferences(actor.id, preferencesFromForm(formData));

    revalidatePath("/account/settings");

    return {
      message: "Notification preferences saved.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Notification preferences could not be saved.",
      status: "error"
    };
  }
}
