"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { sendAdminSmtpTestEmail } from "@/lib/admin/email-test-service";
import { updateGifProviderSettings } from "@/lib/chat/gif-provider-service";
import type { AdminIntegrationsActionState } from "@/app/admin/integrations/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateIntegrationViews() {
  revalidatePath("/admin/integrations");
  revalidatePath("/admin/notification-logs");
  revalidatePath("/admin/audit-logs");
}

export async function adminEmailTestAction(
  _previousState: AdminIntegrationsActionState,
  formData: FormData
): Promise<AdminIntegrationsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "admin.access")) {
    return {
      message: "You do not have permission to test integrations.",
      status: "error"
    };
  }

  try {
    const result = await sendAdminSmtpTestEmail({
      actorDisplayName: actor.displayName,
      actorId: actor.id,
      recipientEmail: formString(formData, "recipientEmail")
    });
    revalidateIntegrationViews();

    return {
      message: `SMTP test email sent to ${result.recipientEmail}.`,
      status: "success"
    };
  } catch (error) {
    revalidateIntegrationViews();

    return {
      message: error instanceof Error ? error.message : "SMTP test email failed.",
      status: "error"
    };
  }
}

export async function adminGifProviderSettingsAction(
  _previousState: AdminIntegrationsActionState,
  formData: FormData
): Promise<AdminIntegrationsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "settings.manage")) {
    return {
      message: "You do not have permission to manage GIF provider credentials.",
      status: "error"
    };
  }

  try {
    await updateGifProviderSettings(
      {
        giphyApiKey: formString(formData, "giphyApiKey"),
        klipyApiKey: formString(formData, "klipyApiKey")
      },
      actor.id
    );
    revalidateIntegrationViews();
    revalidatePath("/chat");
    revalidatePath("/live");

    return {
      message: "GIF provider credentials saved.",
      status: "success"
    };
  } catch (error) {
    revalidateIntegrationViews();

    return {
      message: error instanceof Error ? error.message : "GIF provider settings could not be saved.",
      status: "error"
    };
  }
}
