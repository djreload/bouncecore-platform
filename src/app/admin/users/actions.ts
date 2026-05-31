"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { addAdminUserRole, removeAdminUserRole, updateAdminUserStatus } from "@/lib/auth/user-admin-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateUserAdminViews() {
  revalidatePath("/admin/users");
  revalidatePath("/admin/roles");
  revalidatePath("/admin/permissions");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/account/security");
  revalidatePath("/chat");
  revalidatePath("/live");
}

export async function updateAdminUserStatusAction(formData: FormData) {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "users.manage")) {
    throw new Error("You do not have permission to manage users.");
  }

  await updateAdminUserStatus(formString(formData, "userId"), formString(formData, "status"), actor.id);
  revalidateUserAdminViews();
}

export async function addAdminUserRoleAction(formData: FormData) {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "roles.manage")) {
    throw new Error("You do not have permission to assign roles.");
  }

  await addAdminUserRole(formString(formData, "userId"), formString(formData, "role"), actor.id);
  revalidateUserAdminViews();
}

export async function removeAdminUserRoleAction(formData: FormData) {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "roles.manage")) {
    throw new Error("You do not have permission to remove roles.");
  }

  await removeAdminUserRole(formString(formData, "userId"), formString(formData, "role"), actor.id);
  revalidateUserAdminViews();
}
