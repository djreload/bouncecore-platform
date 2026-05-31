"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { updateRoleDisplayName } from "@/lib/auth/role-display-settings";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateRoleDisplayLabelAction(formData: FormData) {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "roles.manage")) {
    throw new Error("You do not have permission to manage role display labels.");
  }

  await updateRoleDisplayName(formString(formData, "role"), formString(formData, "displayName"), actor.id);

  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
  revalidatePath("/admin/permissions");
  revalidatePath("/admin/stream-keys");
  revalidatePath("/admin/chatrooms");
  revalidatePath("/account/security");
  revalidatePath("/chat");
  revalidatePath("/live");
}
