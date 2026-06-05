"use server";

import { revalidatePath } from "next/cache";
import type { AdminSiteDesignActionState } from "@/app/admin/site-design-state";
import { requireSignedInUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/rbac";
import { updateSiteMenus, type SiteMenusInput } from "@/lib/admin/site-design-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function formNumber(formData: FormData, key: string) {
  const value = Number(formString(formData, key));

  return Number.isFinite(value) ? value : 0;
}

function formKeys(formData: FormData) {
  return formData
    .getAll("menuKey")
    .filter((value): value is string => typeof value === "string");
}

function siteMenusInput(formData: FormData): SiteMenusInput {
  return {
    items: formKeys(formData).map((key) => ({
      enabled: formBoolean(formData, `enabled_${key}`),
      key,
      label: formString(formData, `label_${key}`),
      order: formNumber(formData, `order_${key}`)
    }))
  };
}

export async function adminMenusAction(
  _previousState: AdminSiteDesignActionState,
  formData: FormData
): Promise<AdminSiteDesignActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "site.manage")) {
    return {
      message: "You do not have permission to manage site menus.",
      status: "error"
    };
  }

  try {
    await updateSiteMenus(siteMenusInput(formData), actor.id);
    revalidatePath("/");
    revalidatePath("/admin/menus");
    revalidatePath("/admin/audit-logs");

    return {
      message: "Public menu settings saved.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Public menu settings could not be saved.",
      status: "error"
    };
  }
}
