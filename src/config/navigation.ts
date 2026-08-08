import type { Permission, Role } from "@/lib/auth/roles";

export type IconName =
  | "activity"
  | "badge"
  | "bell"
  | "calendar"
  | "credit-card"
  | "download"
  | "gamepad"
  | "gauge"
  | "gift"
  | "headphones"
  | "home"
  | "key"
  | "layout"
  | "lock"
  | "message"
  | "music"
  | "package"
  | "palette"
  | "radio"
  | "search"
  | "settings"
  | "shield"
  | "shopping-bag"
  | "sparkles"
  | "star"
  | "truck"
  | "upload"
  | "user"
  | "users"
  | "wallet";

export type NavigationItem = {
  label: string;
  href: string;
  icon: IconName;
  group?: string;
  order?: number;
  badge?: string;
  activePrefix?: string;
  requiredRoles?: Role[];
  requiredPermission?: Permission;
};

export const publicNavigation: NavigationItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Live", href: "/live", icon: "radio" },
  { label: "Chat", href: "/chat", icon: "message" },
  { label: "Games", href: "/games", icon: "gamepad" },
  { label: "DJs", href: "/djs", icon: "headphones" },
  { label: "Producers", href: "/producers", icon: "music" },
  { label: "Music", href: "/music", icon: "star" },
  { label: "Shop", href: "/shop", icon: "shopping-bag" },
  { label: "Star Support", href: "/rewards", icon: "star" },
  { label: "Account", href: "/account", icon: "user" }
];

export const accountNavigation: NavigationItem[] = [
  { label: "Overview", href: "/account", icon: "layout", group: "Account" },
  { label: "Profile", href: "/account/profile", icon: "user", group: "Account" },
  { label: "Private messages", href: "/account/messages", icon: "message", group: "Account" },
  { label: "Orders", href: "/account/orders", icon: "package", group: "Commerce" },
  { label: "Downloads", href: "/account/downloads", icon: "download", group: "Commerce" },
  { label: "Stars", href: "/account/rewards", icon: "star", group: "Supporter" },
  { label: "Settings home", href: "/account/settings", icon: "settings", group: "Preferences" },
  { label: "Notification inbox", href: "/account/notifications", icon: "bell", group: "Preferences" },
  { label: "Notification delivery", href: "/account/preferences", icon: "bell", group: "Preferences" },
  { label: "Security", href: "/account/security", icon: "lock", group: "Preferences" },
  { label: "Resource monitor", href: "/account/performance", icon: "gauge", group: "Preferences" },
  { label: "Privacy & data", href: "/account/privacy", icon: "shield", group: "Preferences" }
];

export const accountFeatureNavigation: NavigationItem[] = [
  { label: "Admin control room", href: "/admin", icon: "shield", group: "Assigned features", requiredRoles: ["owner", "admin"] },
  { label: "Moderation tools", href: "/admin/reports", icon: "message", group: "Assigned features", requiredRoles: ["moderator"] },
  { label: "Streamer dashboard", href: "/streamer", icon: "radio", group: "Assigned features", requiredRoles: ["streamer", "admin", "owner"] },
  { label: "Producer dashboard", href: "/producer", icon: "music", group: "Assigned features", requiredRoles: ["producer", "admin", "owner"] },
  { label: "Supporter stars", href: "/account/rewards", icon: "sparkles", group: "Assigned features", requiredRoles: ["supporter"] }
];

export const streamerNavigation: NavigationItem[] = [
  { label: "Streamer overview", href: "/streamer", icon: "radio", group: "Streaming", requiredRoles: ["streamer", "admin", "owner"] },
  { label: "My stream key", href: "/streamer/stream-key", icon: "key", group: "Streaming", requiredRoles: ["streamer", "admin", "owner"] },
  { label: "Stream status", href: "/streamer/status", icon: "activity", group: "Streaming", requiredRoles: ["streamer", "admin", "owner"] },
  { label: "Stream health", href: "/streamer/health", icon: "gauge", group: "Streaming", requiredRoles: ["streamer", "admin", "owner"] },
  { label: "My schedule", href: "/streamer/schedule", icon: "calendar", group: "Streaming", requiredRoles: ["streamer", "admin", "owner"] },
  { label: "Public DJ profile", href: "/streamer/profile", icon: "badge", group: "Profile", requiredRoles: ["streamer", "admin", "owner"] },
  { label: "OBS setup help", href: "/streamer/obs", icon: "settings", group: "Profile", requiredRoles: ["streamer", "admin", "owner"] }
];

export const producerNavigation: NavigationItem[] = [
  { label: "Producer overview", href: "/producer", icon: "music", group: "Producer", requiredRoles: ["producer", "admin", "owner"] },
  { label: "My tracks", href: "/producer/tracks", icon: "star", group: "Producer", requiredRoles: ["producer", "admin", "owner"] },
  { label: "Upload track", href: "/producer/upload", icon: "upload", group: "Producer", requiredRoles: ["producer", "admin", "owner"] },
  { label: "Review status", href: "/producer/reviews", icon: "shield", group: "Producer", requiredRoles: ["producer", "admin", "owner"] },
  { label: "Licenses", href: "/producer/licenses", icon: "badge", group: "Producer", requiredRoles: ["producer", "admin", "owner"] },
  { label: "Sales", href: "/producer/sales", icon: "wallet", group: "Producer", requiredRoles: ["producer", "admin", "owner"] },
  { label: "Downloads", href: "/producer/downloads", icon: "download", group: "Producer", requiredRoles: ["producer", "admin", "owner"] },
  { label: "Producer profile", href: "/producer/profile", icon: "user", group: "Profile", requiredRoles: ["producer", "admin", "owner"] }
];

export const adminNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/admin", icon: "layout", group: "Overview", requiredRoles: ["owner", "admin"] },
  { label: "System health", href: "/admin/system-health", icon: "activity", group: "Overview", requiredRoles: ["owner", "admin"] },
  { label: "Audit logs", href: "/admin/audit-logs", icon: "shield", group: "Overview", requiredPermission: "audit.view" },
  { label: "Users", href: "/admin/users", icon: "users", group: "Users & Access", requiredRoles: ["owner", "admin"] },
  { label: "Roles", href: "/admin/roles", icon: "badge", group: "Users & Access", requiredRoles: ["owner", "admin"] },
  { label: "Permissions", href: "/admin/permissions", icon: "lock", group: "Users & Access", requiredRoles: ["owner", "admin"] },
  { label: "VIP supporters", href: "/admin/supporters", icon: "sparkles", group: "Users & Access", requiredRoles: ["owner", "admin"] },
  { label: "Stream dashboard", href: "/admin/stream", icon: "radio", group: "Live Streaming", requiredRoles: ["owner", "admin"] },
  { label: "Stream keys", href: "/admin/stream-keys", icon: "key", group: "Live Streaming", requiredRoles: ["owner", "admin"] },
  { label: "Stream sessions", href: "/admin/stream-sessions", icon: "activity", group: "Live Streaming", requiredRoles: ["owner", "admin"] },
  { label: "Schedules", href: "/admin/schedules", icon: "calendar", group: "Live Streaming", requiredRoles: ["owner", "admin"] },
  { label: "Chatrooms", href: "/admin/chatrooms", icon: "message", group: "Chat & Moderation", requiredPermission: "moderation.use" },
  { label: "Rave War diagnostics", href: "/admin/rave-wars", icon: "activity", group: "Chat & Moderation", requiredPermission: "settings.manage" },
  { label: "Rave War levels", href: "/admin/rave-war-levels", icon: "layout", group: "Chat & Moderation", requiredPermission: "settings.manage" },
  { label: "Chat assets", href: "/admin/chat-assets", icon: "sparkles", group: "Chat & Moderation", requiredRoles: ["owner", "admin"] },
  { label: "Reports", href: "/admin/reports", icon: "shield", group: "Chat & Moderation", requiredPermission: "moderation.use" },
  { label: "Bans", href: "/admin/bans", icon: "lock", group: "Chat & Moderation", requiredPermission: "moderation.use" },
  { label: "Tracks", href: "/admin/tracks", icon: "music", group: "Music Marketplace", requiredRoles: ["owner", "admin"] },
  { label: "Producer approvals", href: "/admin/producer-approvals", icon: "shield", group: "Music Marketplace", requiredRoles: ["owner", "admin"] },
  { label: "Products", href: "/admin/products", icon: "shopping-bag", group: "Merch Shop", requiredRoles: ["owner", "admin"] },
  { label: "Orders", href: "/admin/orders", icon: "package", group: "Merch Shop", requiredRoles: ["owner", "admin"] },
  { label: "Fulfilment", href: "/admin/fulfilment", icon: "truck", group: "Merch Shop", requiredRoles: ["owner", "admin"] },
  { label: "Payments", href: "/admin/payments", icon: "credit-card", group: "Payments & Money", requiredRoles: ["owner", "admin"] },
  { label: "Stars", href: "/admin/stars", icon: "star", group: "Payments & Money", requiredRoles: ["owner", "admin"] },
  { label: "Spin wheels", href: "/admin/spin-wheels", icon: "gift", group: "Rewards", requiredRoles: ["owner", "admin"] },
  { label: "Prize claims", href: "/admin/prize-claims", icon: "badge", group: "Rewards", requiredRoles: ["owner", "admin"] },
  { label: "App config", href: "/admin/mobile", icon: "settings", group: "Mobile App", requiredRoles: ["owner", "admin"] },
  { label: "Push notifications", href: "/admin/push", icon: "bell", group: "Mobile App", requiredRoles: ["owner", "admin"] },
  { label: "Notification logs", href: "/admin/notification-logs", icon: "activity", group: "Mobile App", requiredRoles: ["owner", "admin"] },
  { label: "Pages", href: "/admin/pages", icon: "layout", group: "Site & Design", requiredRoles: ["owner", "admin"] },
  { label: "Menus", href: "/admin/menus", icon: "search", group: "Site & Design", requiredRoles: ["owner", "admin"] },
  { label: "Themes", href: "/admin/themes", icon: "palette", group: "Site & Design", requiredRoles: ["owner", "admin"] },
  {
    label: "General settings",
    href: "/admin/settings",
    icon: "settings",
    group: "Settings",
    requiredRoles: ["owner", "admin"],
    requiredPermission: "settings.manage"
  },
  { label: "Support inbox", href: "/admin/support", icon: "message", group: "Settings", requiredRoles: ["owner", "admin"] },
  {
    label: "Storage",
    href: "/admin/storage",
    icon: "upload",
    group: "Settings",
    requiredRoles: ["owner", "admin"],
    requiredPermission: "settings.manage"
  },
  { label: "Integrations", href: "/admin/integrations", icon: "activity", group: "Settings", requiredRoles: ["owner", "admin"] }
];

export const navigationGroupDescriptions: Record<string, string> = {
  Account: "Account overview and public profile identity.",
  Commerce: "Orders you placed and music files you own.",
  Supporter: "Your star wallet, purchases, and supporter activity.",
  Preferences: "Notifications, security, performance, privacy, and data controls.",
  "Assigned features": "Workspaces unlocked by your account roles.",
  Overview: "System status, activity, and operational checks.",
  "Users & Access": "Accounts, roles, permissions, and VIP access.",
  "Live Streaming": "Ingest, stream keys, sessions, and schedules.",
  "Chat & Moderation": "Rooms, uploads, reports, and enforcement tools.",
  Games: "Standalone game services, player access, and runtime configuration.",
  "Music Marketplace": "Producer submissions and public track catalogue.",
  "Merch Shop": "Products, customer orders, and fulfilment.",
  "Payments & Money": "Payment providers, stars, transactions, and payouts.",
  Rewards: "Spin wheels, prizes, and outstanding claims.",
  "Mobile App": "Android configuration, push delivery, and notification logs.",
  "Site & Design": "Public pages, menus, branding, and visual themes.",
  Settings: "General configuration, support, storage, and integrations.",
  Streaming: "Your broadcast key, status, health, and schedule.",
  Profile: "Public DJ or producer identity and setup guidance.",
  Producer: "Tracks, sales, licences, and producer operations."
};

export function groupNavigation(items: NavigationItem[]) {
  return items.reduce<Record<string, NavigationItem[]>>((groups, item) => {
    const group = item.group ?? "Main";
    groups[group] = [...(groups[group] ?? []), item];
    return groups;
  }, {});
}

export function findActiveNavigationItem(items: NavigationItem[], pathname: string) {
  return items
    .filter((item) => {
      if (pathname === item.href) {
        return true;
      }

      const prefix = item.activePrefix ?? `${item.href.replace(/\/$/, "")}/`;
      return item.href !== "/" && pathname.startsWith(prefix);
    })
    .sort((first, second) => {
      const firstExact = pathname === first.href ? 1 : 0;
      const secondExact = pathname === second.href ? 1 : 0;

      return secondExact - firstExact || second.href.length - first.href.length;
    })[0];
}
