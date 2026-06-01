"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { grantSupporterRole, removeSupporterRole } from "@/lib/admin/supporters";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateSupporterViews() {
  revalidatePath("/admin/supporters");
  revalidatePath("/admin/users");
  revalidatePath("/admin/roles");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/account/security");
  revalidatePath("/chat");
  revalidatePath("/live");
}

export async function grantSupporterRoleAction(formData: FormData) {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "roles.manage")) {
    throw new Error("You do not have permission to grant supporter access.");
  }

  await grantSupporterRole(formString(formData, "userId"), actor.id);
  revalidateSupporterViews();
}

export async function removeSupporterRoleAction(formData: FormData) {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "roles.manage")) {
    throw new Error("You do not have permission to remove supporter access.");
  }

  await removeSupporterRole(formString(formData, "userId"), actor.id);
  revalidateSupporterViews();
}
