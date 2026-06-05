import { redirect } from "next/navigation";
import type { Permission, Role } from "@/lib/auth/rbac";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";

const loginPath = "/auth/login?error=auth-required";
const deniedPath = "/account/security?error=access-denied";

export async function requireSignedInUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(loginPath);
  }

  return user;
}

export async function requireAnyRole(allowedRoles: readonly Role[]) {
  const user = await requireSignedInUser();

  if (!allowedRoles.some((role) => user.roles.includes(role))) {
    redirect(deniedPath);
  }

  return user;
}

export async function requireUserPermission(permission: Permission) {
  const user = await requireSignedInUser();

  if (!hasPermission(user, permission)) {
    redirect(deniedPath);
  }

  return user;
}

export async function getApiUserWithPermission(permission: Permission) {
  const user = await getCurrentUser();

  if (!hasPermission(user, permission)) {
    return null;
  }

  return user;
}
