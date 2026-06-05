"use server";

import { revalidatePath } from "next/cache";
import type { AdminSiteDesignActionState } from "@/app/admin/site-design-state";
import { requireSignedInUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/rbac";
import { updateSitePages, type SitePagesInput } from "@/lib/admin/site-design-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function formKeys(formData: FormData) {
  return formData
    .getAll("pageKey")
    .filter((value): value is string => typeof value === "string");
}

function sitePagesInput(formData: FormData): SitePagesInput {
  return {
    pages: formKeys(formData).map((key) => ({
      description: formString(formData, `description_${key}`),
      enabled: formBoolean(formData, `enabled_${key}`),
      featured: formBoolean(formData, `featured_${key}`),
      key,
      title: formString(formData, `title_${key}`)
    }))
  };
}

export async function adminPagesAction(
  _previousState: AdminSiteDesignActionState,
  formData: FormData
): Promise<AdminSiteDesignActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "site.manage")) {
    return {
      message: "You do not have permission to manage site pages.",
      status: "error"
    };
  }

  try {
    await updateSitePages(sitePagesInput(formData), actor.id);
    revalidatePath("/");
    revalidatePath("/admin/pages");
    revalidatePath("/admin/audit-logs");

    return {
      message: "Public page settings saved.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Public page settings could not be saved.",
      status: "error"
    };
  }
}
