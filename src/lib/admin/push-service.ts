import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeRole } from "@/lib/auth/role-normalize";
import { roleDefinitions, type Role } from "@/lib/auth/rbac";
import { roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { prisma } from "@/lib/db/prisma";

export const adminPushTargets = ["all", "role", "user"] as const;

export type AdminPushTarget = (typeof adminPushTargets)[number];

export type AdminPushInput = {
  body?: string;
  role?: string;
  target: string;
  title: string;
  type: string;
  userId?: string;
};

export type AdminPushData = {
  recentNotifications: Array<{
    body: string | null;
    createdAt: string;
    id: string;
    readAt: string | null;
    title: string;
    type: string;
    userDisplayName: string;
    userEmail: string;
  }>;
  roles: Array<{
    activeUserCount: number;
    key: Role;
    label: string;
  }>;
  stats: {
    activeUsers: number;
    sentToday: number;
    totalNotifications: number;
    unreadNotifications: number;
  };
  users: Array<{
    displayName: string;
    email: string;
    id: string;
    roles: Role[];
    status: string;
  }>;
};

function normalizedText(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function normalizedRequiredText(value: string | undefined, maxLength: number, label: string) {
  const text = normalizedText(value, maxLength);

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function normalizeTarget(value: string): AdminPushTarget {
  if (adminPushTargets.includes(value as AdminPushTarget)) {
    return value as AdminPushTarget;
  }

  throw new Error("Notification target is invalid.");
}

function normalizeNotificationType(value: string) {
  const type = normalizedRequiredText(value, 40, "Notification type").toLowerCase();

  if (!/^[a-z0-9._-]+$/.test(type)) {
    throw new Error("Notification type can only contain lowercase letters, numbers, dots, underscores, or dashes.");
  }

  return type;
}

function toRoleList(values: string[]) {
  return values.flatMap((value) => {
    const role = normalizeRole(value);
    return role ? [role] : [];
  });
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getAdminPushData(): Promise<AdminPushData> {
  const [roleDisplayLabels, users, recentNotifications, totalNotifications, unreadNotifications, sentToday] = await Promise.all([
    getRoleDisplayNameOverrides(),
    prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      },
      orderBy: {
        displayName: "asc"
      }
    }),
    prisma.notification.findMany({
      include: {
        user: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 30
    }),
    prisma.notification.count(),
    prisma.notification.count({
      where: {
        readAt: null
      }
    }),
    prisma.notification.count({
      where: {
        createdAt: {
          gte: startOfToday()
        }
      }
    })
  ]);

  const userRows = users.map((user) => ({
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    roles: toRoleList(user.roles.map((userRole) => userRole.role.name)),
    status: user.status
  }));
  const activeUsers = userRows.filter((user) => user.status === "active");
  const roleCounts = activeUsers.reduce<Map<Role, number>>((counts, user) => {
    for (const role of user.roles) {
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }

    return counts;
  }, new Map<Role, number>());

  return {
    recentNotifications: recentNotifications.map((notification) => ({
      body: notification.body,
      createdAt: notification.createdAt.toISOString(),
      id: notification.id,
      readAt: notification.readAt?.toISOString() ?? null,
      title: notification.title,
      type: notification.type,
      userDisplayName: notification.user.displayName,
      userEmail: notification.user.email
    })),
    roles: roleDefinitions.map((role) => ({
      activeUserCount: roleCounts.get(role.key) ?? 0,
      key: role.key,
      label: roleDisplayName(role.key, roleDisplayLabels)
    })),
    stats: {
      activeUsers: activeUsers.length,
      sentToday,
      totalNotifications,
      unreadNotifications
    },
    users: userRows
  };
}

export async function sendAdminNotification(actorId: string, input: AdminPushInput) {
  const target = normalizeTarget(input.target);
  const type = normalizeNotificationType(input.type);
  const title = normalizedRequiredText(input.title, 120, "Title");
  const body = normalizedText(input.body, 600);
  const role = input.role ? normalizeRole(input.role) : null;

  if (target === "role" && !role) {
    throw new Error("Choose a valid target role.");
  }

  if (target === "user" && !input.userId?.trim()) {
    throw new Error("Choose a target user.");
  }

  let recipientWhere: Prisma.UserWhereInput = {
    status: "active"
  };

  if (target === "role") {
    const roleName = role;

    if (!roleName) {
      throw new Error("Choose a valid target role.");
    }

    recipientWhere = {
      roles: {
        some: {
          role: {
            name: roleName
          }
        }
      },
      status: "active"
    };
  }

  if (target === "user") {
    recipientWhere = {
      id: input.userId?.trim(),
      status: "active"
    };
  }

  const recipients = await prisma.user.findMany({
    where: recipientWhere,
    select: {
      id: true
    }
  });

  if (!recipients.length) {
    throw new Error("No active users matched that notification target.");
  }

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      body,
      title,
      type,
      userId: recipient.id
    }))
  });

  await writeAuditLog({
    actorId,
    action: "notifications.admin_send",
    target: `notification-target:${target}`,
    severity: target === "user" ? "info" : "warning",
    metadata: {
      recipientCount: recipients.length,
      role,
      target,
      title,
      type
    }
  });

  return {
    recipientCount: recipients.length
  };
}
