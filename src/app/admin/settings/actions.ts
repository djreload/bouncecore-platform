"use server";

import { revalidatePath } from "next/cache";
import { adminSettingsInput } from "@/app/admin/settings/form";
import type { AdminSettingsActionState } from "@/app/admin/settings/state";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { updateSiteSettings } from "@/lib/admin/site-settings-service";

function revalidateSiteSettingsViews() {
  revalidatePath("/");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/audit-logs");
}

export async function adminSettingsAction(
  _previousState: AdminSettingsActionState,
  formData: FormData
): Promise<AdminSettingsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "settings.manage")) {
    return {
      message: "You do not have permission to manage general settings.",
      status: "error"
    };
  }

  try {
    await updateSiteSettings(adminSettingsInput(formData), actor.id);
    revalidateSiteSettingsViews();

    return {
      message: "General site settings saved.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "General site settings could not be saved.",
      status: "error"
    };
  }
}
