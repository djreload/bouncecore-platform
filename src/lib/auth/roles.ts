export const roles = [
  "owner",
  "admin",
  "moderator",
  "streamer",
  "producer",
  "customer",
  "viewer",
  "supporter"
] as const;

export type Role = (typeof roles)[number];

const permissionConfig = {
  "admin.access": ["owner", "admin"],
  "users.manage": ["owner", "admin"],
  "roles.manage": ["owner", "admin"],
  "moderation.use": ["owner", "admin", "moderator"],
  "stream.keys.manage.any": ["owner", "admin"],
  "stream.keys.manage.own": ["owner", "admin", "streamer"],
  "stream.keys.view.raw.any": ["owner", "admin"],
  "stream.keys.view.raw.own": ["owner", "admin", "streamer"],
  "producer.dashboard": ["owner", "admin", "producer"],
  "shop.manage": ["owner", "admin"],
  "music.manage": ["owner", "admin"],
  "rewards.manage": ["owner", "admin"],
  "mobile.manage": ["owner", "admin"]
} as const;

export const permissions: Record<keyof typeof permissionConfig, readonly Role[]> = permissionConfig;

export type Permission = keyof typeof permissionConfig;

export function roleCan(role: Role, permission: Permission) {
  return permissions[permission].includes(role);
}
