"use server";

import { revalidatePath } from "next/cache";
import type { AdminUserInviteActionState } from "@/app/admin/users/state";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { addAdminUserRole, removeAdminUserRole, updateAdminUserStatus } from "@/lib/auth/user-admin-service";
import { sendInviteEmail } from "@/lib/auth/email-verification-service";
import { deleteUserAndRelatedData } from "@/lib/auth/user-deletion-service";
import { createAdminUserInvite, revokeAdminUserInvite, rolesFromInviteJson } from "@/lib/auth/user-invite-service";
import { prisma } from "@/lib/db/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formStrings(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
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

function adminInviteUrl(token: string) {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const url = new URL("/auth/register", origin);

  url.searchParams.set("invite", token);

  return url.toString();
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

export async function deleteAdminUserAction(formData: FormData) {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "users.manage")) {
    throw new Error("You do not have permission to delete users.");
  }

  const userId = formString(formData, "userId");
  const confirmation = formString(formData, "confirmation").trim().toLowerCase();

  if (!userId) {
    throw new Error("Missing user.");
  }

  if (userId === actor.id) {
    throw new Error("Use account settings to delete your own account.");
  }

  const target = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId
    },
    select: {
      email: true
    }
  });

  if (confirmation !== target.email.toLowerCase()) {
    throw new Error("Type the user's email address to confirm deletion.");
  }

  await deleteUserAndRelatedData({
    actorId: actor.id,
    mode: "admin",
    reason: "Deleted from the admin user directory.",
    targetUserId: userId
  });

  revalidateUserAdminViews();
}

export async function createAdminUserInviteAction(
  _previousState: AdminUserInviteActionState,
  formData: FormData
): Promise<AdminUserInviteActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "users.manage")) {
    return {
      message: "You do not have permission to invite users.",
      status: "error"
    };
  }

  try {
    const invite = await createAdminUserInvite(
      {
        email: formString(formData, "email"),
        expiresDays: formString(formData, "expiresDays"),
        note: formString(formData, "note"),
        roles: formStrings(formData, "roles")
      },
      actor.id
    );

    const inviteUrl = adminInviteUrl(invite.token);
    const inviteEmail = await sendInviteEmail({
      email: invite.invite.email,
      inviteUrl,
      roles: rolesFromInviteJson(invite.invite.roles)
    }).catch(() => ({
      configured: true,
      sent: false
    }));

    revalidateUserAdminViews();

    return {
      inviteUrl,
      message: inviteEmail.sent
        ? "Invite created and emailed. Copy this link now as a backup; the raw token is not stored."
        : "Invite created. Copy this link now; SMTP is not configured or the email was not sent.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Could not create invite.",
      status: "error"
    };
  }
}

export async function revokeAdminUserInviteAction(formData: FormData) {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "users.manage")) {
    throw new Error("You do not have permission to revoke invites.");
  }

  await revokeAdminUserInvite(formString(formData, "inviteId"), actor.id);
  revalidateUserAdminViews();
}
