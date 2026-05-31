import type { Role } from "@/lib/auth/roles";

export type IconName =
  | "activity"
  | "badge"
  | "bell"
  | "calendar"
  | "credit-card"
  | "download"
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
  requiredPermission?: string;
};

export const publicNavigation: NavigationItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Live", href: "/live", icon: "radio" },
  { label: "Chat", href: "/chat", icon: "message" },
  { label: "DJs", href: "/djs", icon: "headphones" },
  { label: "Producers", href: "/producers", icon: "music" },
  { label: "Music", href: "/music", icon: "star" },
  { label: "Shop", href: "/shop", icon: "shopping-bag" },
  { label: "Rewards", href: "/rewards", icon: "gift" },
  { label: "Account", href: "/account", icon: "user" }
];

export const accountNavigation: NavigationItem[] = [
  { label: "Overview", href: "/account", icon: "layout", group: "Account" },
  { label: "Profile", href: "/account/profile", icon: "user", group: "Account" },
  { label: "Orders", href: "/account/orders", icon: "package", group: "Commerce" },
  { label: "Downloads", href: "/account/downloads", icon: "download", group: "Commerce" },
  { label: "Rewards", href: "/account/rewards", icon: "gift", group: "Supporter" },
  { label: "Notifications", href: "/account/notifications", icon: "bell", group: "Account" },
  { label: "Security", href: "/account/security", icon: "lock", group: "Account" },
  { label: "Settings", href: "/account/settings", icon: "settings", group: "Account" }
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
  { label: "Audit logs", href: "/admin/audit-logs", icon: "shield", group: "Overview", requiredRoles: ["owner", "admin"] },
  { label: "Users", href: "/admin/users", icon: "users", group: "Users & Access", requiredRoles: ["owner", "admin"] },
  { label: "Roles", href: "/admin/roles", icon: "badge", group: "Users & Access", requiredRoles: ["owner", "admin"] },
  { label: "Permissions", href: "/admin/permissions", icon: "lock", group: "Users & Access", requiredRoles: ["owner", "admin"] },
  { label: "VIP supporters", href: "/admin/supporters", icon: "sparkles", group: "Users & Access", requiredRoles: ["owner", "admin"] },
  { label: "Stream dashboard", href: "/admin/stream", icon: "radio", group: "Live Streaming", requiredRoles: ["owner", "admin"] },
  { label: "Stream keys", href: "/admin/stream-keys", icon: "key", group: "Live Streaming", requiredRoles: ["owner", "admin"] },
  { label: "Stream sessions", href: "/admin/stream-sessions", icon: "activity", group: "Live Streaming", requiredRoles: ["owner", "admin"] },
  { label: "Schedules", href: "/admin/schedules", icon: "calendar", group: "Live Streaming", requiredRoles: ["owner", "admin"] },
  { label: "Chatrooms", href: "/admin/chatrooms", icon: "message", group: "Chat & Moderation", requiredRoles: ["owner", "admin"] },
  { label: "Reports", href: "/admin/reports", icon: "shield", group: "Chat & Moderation", requiredRoles: ["owner", "admin"] },
  { label: "Bans", href: "/admin/bans", icon: "lock", group: "Chat & Moderation", requiredRoles: ["owner", "admin"] },
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
  { label: "Pages", href: "/admin/pages", icon: "layout", group: "Site & Design", requiredRoles: ["owner", "admin"] },
  { label: "Menus", href: "/admin/menus", icon: "search", group: "Site & Design", requiredRoles: ["owner", "admin"] },
  { label: "Themes", href: "/admin/themes", icon: "palette", group: "Site & Design", requiredRoles: ["owner", "admin"] },
  { label: "General settings", href: "/admin/settings", icon: "settings", group: "Settings", requiredRoles: ["owner", "admin"] },
  { label: "Integrations", href: "/admin/integrations", icon: "activity", group: "Settings", requiredRoles: ["owner", "admin"] }
];

export function groupNavigation(items: NavigationItem[]) {
  return items.reduce<Record<string, NavigationItem[]>>((groups, item) => {
    const group = item.group ?? "Main";
    groups[group] = [...(groups[group] ?? []), item];
    return groups;
  }, {});
}
