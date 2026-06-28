"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  notificationPreferenceCategories,
  type NotificationPreferences
} from "@/lib/account/notification-preferences-core";
import { accountDeletionConfirmationText } from "@/lib/account/account-deletion-core";
import { requestAccountDeletion } from "@/lib/account/account-deletion-service";
import { sessionCookieName } from "@/lib/auth/session";
import { deleteUserAndRelatedData } from "@/lib/auth/user-deletion-service";
import { updateUserNotificationPreferences } from "@/lib/account/notification-preferences-service";
import type { AccountDeletionActionState, NotificationPreferencesActionState } from "@/app/account/settings/state";

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

export async function requestAccountDeletionAction(
  _previousState: AccountDeletionActionState,
  formData: FormData
): Promise<AccountDeletionActionState> {
  const actor = await requireSignedInUser();

  try {
    await requestAccountDeletion(actor, {
      confirmation: typeof formData.get("confirmation") === "string" ? String(formData.get("confirmation")) : "",
      reason: typeof formData.get("reason") === "string" ? String(formData.get("reason")) : ""
    });

    revalidatePath("/account/settings");

    return {
      message: "Account deletion request submitted. The site operator must review retention requirements before removal.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Account deletion request could not be submitted.",
      status: "error"
    };
  }
}

export async function deleteOwnAccountAction(
  _previousState: AccountDeletionActionState,
  formData: FormData
): Promise<AccountDeletionActionState> {
  const actor = await requireSignedInUser();
  const confirmation = typeof formData.get("confirmation") === "string" ? String(formData.get("confirmation")).trim() : "";
  const reason = typeof formData.get("reason") === "string" ? String(formData.get("reason")) : "";

  try {
    if (confirmation !== accountDeletionConfirmationText) {
      throw new Error(`Type ${accountDeletionConfirmationText} to permanently delete your account.`);
    }

    await deleteUserAndRelatedData({
      actorId: actor.id,
      mode: "self",
      reason,
      targetUserId: actor.id
    });

    const cookieStore = await cookies();

    cookieStore.delete(sessionCookieName);
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Account could not be deleted.",
      status: "error"
    };
  }

  redirect("/auth/login?deleted=1");
}
