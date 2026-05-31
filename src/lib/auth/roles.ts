export {
  filterNavigationByRoles,
  groupPermissionsByArea,
  hasPermission,
  hasRole,
  permissionDefinitions,
  requirePermission,
  roleDefinitions,
  rolePermissions
} from "@/lib/auth/rbac";
export type { CurrentUser, Permission, Role } from "@/lib/auth/rbac";
