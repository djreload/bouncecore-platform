import type { Role } from "@/lib/auth/rbac";

const roleDisplayNames: Partial<Record<Role, string>> = {
  owner: "Server owner",
  admin: "Stream owner"
};

export function roleDisplayName(role: Role | string) {
  return roleDisplayNames[role as Role] ?? role;
}

export function roleBadgeTone(role: Role | string) {
  if (role === "owner") {
    return "pink" as const;
  }

  if (role === "admin" || role === "moderator") {
    return "amber" as const;
  }

  if (role === "streamer" || role === "producer") {
    return "cyan" as const;
  }

  if (role === "supporter") {
    return "acid" as const;
  }

  return "muted" as const;
}
