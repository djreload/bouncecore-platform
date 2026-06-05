"use server";

import { revalidatePath } from "next/cache";
import type { AdminSiteDesignActionState } from "@/app/admin/site-design-state";
import { requireSignedInUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/rbac";
import { updateSiteTheme, type SiteThemeInput } from "@/lib/admin/site-design-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formKeys(formData: FormData) {
  return formData
    .getAll("themeKey")
    .filter((value): value is string => typeof value === "string");
}

function siteThemeInput(formData: FormData): SiteThemeInput {
  return {
    tokens: formKeys(formData).map((key) => ({
      key,
      value: formString(formData, `value_${key}`)
    }))
  };
}

export async function adminThemesAction(
  _previousState: AdminSiteDesignActionState,
  formData: FormData
): Promise<AdminSiteDesignActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "site.manage")) {
    return {
      message: "You do not have permission to manage site themes.",
      status: "error"
    };
  }

  try {
    await updateSiteTheme(siteThemeInput(formData), actor.id);
    revalidatePath("/");
    revalidatePath("/admin/themes");
    revalidatePath("/admin/audit-logs");

    return {
      message: "Theme settings saved.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Theme settings could not be saved.",
      status: "error"
    };
  }
}
