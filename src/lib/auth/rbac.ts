import type { NavigationItem } from "@/config/navigation";

export const roleDefinitions = [
  {
    key: "owner",
    label: "Server Owner",
    description: "Server-owner control, owner-only settings, admin management, stream-key audit, and system ownership."
  },
  {
    key: "admin",
    label: "Stream Owner",
    description: "Stream-owner operations across users, streams, chat, shop, music, payments, rewards, mobile, and site settings."
  },
  {
    key: "moderator",
    label: "Moderator",
    description: "Chat moderation, reports, bans, timeouts, and moderation logs without raw stream-key access by default."
  },
  {
    key: "streamer",
    label: "DJ/Streamer",
    description: "Streamer dashboard, own stream key, public DJ profile, schedule, status, health, and OBS setup."
  },
  {
    key: "producer",
    label: "Producer",
    description: "Producer dashboard, tracks, uploads, approvals, licenses, sales, downloads, and producer profile."
  },
  {
    key: "customer",
    label: "Customer",
    description: "Orders, downloads, purchases, rewards, account security, and profile settings."
  },
  {
    key: "viewer",
    label: "Viewer",
    description: "Watch streams, join allowed chatrooms, follow creators, and manage a public profile."
  },
  {
    key: "supporter",
    label: "Supporter/VIP",
    description: "Supporter badges, VIP perks, stars wallet, prize wins, rewards, and supporter-only spaces."
  }
] as const;

export type Role = (typeof roleDefinitions)[number]["key"];

export const permissionDefinitions = [
  { key: "admin.access", group: "Admin", description: "Access the admin control room." },
  { key: "users.manage", group: "Users & Access", description: "Create, edit, suspend, and inspect users." },
  { key: "roles.manage", group: "Users & Access", description: "Manage roles and role assignments." },
  { key: "permissions.manage", group: "Users & Access", description: "Manage permission grants." },
  { key: "profiles.manage", group: "Users & Access", description: "Manage public profiles." },
  { key: "moderation.use", group: "Chat & Moderation", description: "Moderate chatrooms and reports." },
  { key: "stream.dashboard", group: "Live Streaming", description: "View stream dashboard, sessions, status, and health." },
  { key: "stream.keys.manage.any", group: "Live Streaming", description: "Create, rotate, disable, revoke, or audit any stream key." },
  { key: "stream.keys.manage.own", group: "Live Streaming", description: "Create, rotate, disable, or revoke own stream key." },
  { key: "stream.keys.view.raw.any", group: "Live Streaming", description: "Reveal any raw stream key in secure admin views." },
  { key: "stream.keys.view.raw.own", group: "Live Streaming", description: "Reveal own raw stream key in secure dashboard views." },
  { key: "stream.settings.manage", group: "Live Streaming", description: "Manage stream provider settings." },
  { key: "producer.dashboard", group: "Music Marketplace", description: "Access producer dashboard." },
  { key: "music.manage", group: "Music Marketplace", description: "Manage tracks, approvals, licenses, and producer reports." },
  { key: "shop.manage", group: "Merch Shop", description: "Manage products, variants, stock, orders, and fulfilment." },
  { key: "payments.manage", group: "Payments & Money", description: "Manage payment settings, refunds, transactions, stars, and donations." },
  { key: "rewards.manage", group: "Rewards", description: "Manage achievements, spin wheels, prize wins, and prize claims." },
  { key: "mobile.manage", group: "Mobile App", description: "Manage mobile app config, feature flags, push notifications, and ads." },
  { key: "site.manage", group: "Site & Design", description: "Manage pages, menus, themes, media, and SEO." },
  { key: "settings.manage", group: "Settings", description: "Manage platform security, integrations, and general settings." },
  { key: "audit.view", group: "Overview", description: "View audit logs and sensitive operational history." }
] as const;

export type Permission = (typeof permissionDefinitions)[number]["key"];

export const rolePermissions = {
  owner: permissionDefinitions.map((permission) => permission.key),
  admin: permissionDefinitions
    .map((permission) => permission.key)
    .filter((permission) => permission !== "settings.manage" && permission !== "stream.keys.view.raw.any"),
  moderator: ["moderation.use", "audit.view"],
  streamer: ["stream.dashboard", "stream.keys.manage.own", "stream.keys.view.raw.own"],
  producer: ["producer.dashboard"],
  customer: [],
  viewer: [],
  supporter: []
} as const satisfies Record<Role, readonly Permission[]>;

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
};

export function hasRole(user: Pick<CurrentUser, "roles"> | null | undefined, role: Role) {
  return Boolean(user?.roles.includes(role));
}

export function hasPermission(user: Pick<CurrentUser, "roles"> | null | undefined, permission: Permission) {
  if (!user) {
    return false;
  }

  return user.roles.some((role) => (rolePermissions[role] as readonly Permission[]).includes(permission));
}

export function requirePermission(user: Pick<CurrentUser, "roles"> | null | undefined, permission: Permission) {
  if (!hasPermission(user, permission)) {
    throw new Error(`Missing required Bouncecore permission: ${permission}`);
  }
}

export function filterNavigationByRoles(items: NavigationItem[], roles: Role[]) {
  return items.filter((item) => {
    if (!item.requiredRoles?.length) {
      return true;
    }

    return item.requiredRoles.some((role) => roles.includes(role));
  });
}

export function groupPermissionsByArea() {
  return permissionDefinitions.reduce<Record<string, typeof permissionDefinitions[number][]>>((groups, permission) => {
    groups[permission.group] = [...(groups[permission.group] ?? []), permission];
    return groups;
  }, {});
}
