import { roleDefinitions, type Role } from "@/lib/auth/rbac";

const roleSet = new Set<string>(roleDefinitions.map((role) => role.key));

export function normalizeRole(value: string): Role | null {
  return roleSet.has(value) ? (value as Role) : null;
}

export function normalizeRoles(values: string[]) {
  return values.flatMap((value) => {
    const role = normalizeRole(value);
    return role ? [role] : [];
  });
}
