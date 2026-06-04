import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeRoles } from "@/lib/auth/role-normalize";
import type { Role } from "@/lib/auth/rbac";
import { makeProfileSlug } from "@/lib/auth/slugs";
import { prisma } from "@/lib/db/prisma";

export type AccountProfileInput = {
  avatarUrl?: string;
  bio?: string;
  displayName: string;
  isPublic: boolean;
  location?: string;
  slug: string;
  websiteUrl?: string;
};

export type AccountProfileData = {
  email: string;
  displayName: string;
  createdAt: string;
  profile: {
    avatarUrl: string | null;
    bio: string | null;
    isPublic: boolean;
    location: string | null;
    slug: string;
    websiteUrl: string | null;
  };
  roles: Role[];
};

export type AccountOverviewData = {
  displayName: string;
  email: string;
  profileSlug: string;
  profileIsPublic: boolean;
  stats: {
    orders: number;
    musicPurchases: number;
    notificationsUnread: number;
    rewardsBalance: number;
    sessions: number;
  };
};

export type AccountNotificationRow = {
  id: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
  title: string;
  type: string;
};

export type AccountNotificationsData = {
  notifications: AccountNotificationRow[];
  stats: {
    total: number;
    unread: number;
    read: number;
  };
};

export type AccountSettingsData = {
  displayName: string;
  email: string;
  status: string;
  emailVerifiedAt: string | null;
  profileIsPublic: boolean;
  profileSlug: string;
  activeSessions: number;
  unreadNotifications: number;
  roles: Role[];
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

function normalizedUrl(value: string | undefined, maxLength: number) {
  const text = normalizedText(value, maxLength);

  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new Error("URLs must start with http:// or https://.");
  }
}

function normalizeSlug(value: string, displayName: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || makeProfileSlug(displayName);
}

function toProfileData(user: {
  email: string;
  displayName: string;
  createdAt: Date;
  profile: {
    avatarUrl: string | null;
    bio: string | null;
    isPublic: boolean;
    location: string | null;
    slug: string;
    websiteUrl: string | null;
  } | null;
  roles: Array<{
    role: {
      name: string;
    };
  }>;
}): AccountProfileData {
  return {
    createdAt: user.createdAt.toISOString(),
    displayName: user.displayName,
    email: user.email,
    profile: {
      avatarUrl: user.profile?.avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      isPublic: user.profile?.isPublic ?? true,
      location: user.profile?.location ?? null,
      slug: user.profile?.slug ?? normalizeSlug(user.displayName, user.displayName),
      websiteUrl: user.profile?.websiteUrl ?? null
    },
    roles: normalizeRoles(user.roles.map((userRole) => userRole.role.name))
  };
}

export async function getAccountProfileData(userId: string): Promise<AccountProfileData> {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId
    },
    include: {
      profile: true,
      roles: {
        include: {
          role: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  return toProfileData(user);
}

export async function updateAccountProfile(userId: string, input: AccountProfileInput) {
  const displayName = normalizedRequiredText(input.displayName, 80, "Display name");
  const slug = normalizeSlug(input.slug, displayName);

  if (slug.length < 3) {
    throw new Error("Profile slug must be at least 3 characters.");
  }

  const existingSlug = await prisma.profile.findUnique({
    where: {
      slug
    },
    select: {
      userId: true
    }
  });

  if (existingSlug && existingSlug.userId !== userId) {
    throw new Error("That profile slug is already in use.");
  }

  const profile = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: userId
      },
      data: {
        displayName
      }
    });

    return tx.profile.upsert({
      where: {
        userId
      },
      update: {
        avatarUrl: normalizedUrl(input.avatarUrl, 300),
        bio: normalizedText(input.bio, 600),
        isPublic: input.isPublic,
        location: normalizedText(input.location, 80),
        slug,
        websiteUrl: normalizedUrl(input.websiteUrl, 300)
      },
      create: {
        avatarUrl: normalizedUrl(input.avatarUrl, 300),
        bio: normalizedText(input.bio, 600),
        isPublic: input.isPublic,
        location: normalizedText(input.location, 80),
        slug,
        userId,
        websiteUrl: normalizedUrl(input.websiteUrl, 300)
      }
    });
  });

  await writeAuditLog({
    actorId: userId,
    action: "account.profile.update",
    target: `profile:${profile.id}`,
    severity: "info",
    metadata: {
      displayName,
      isPublic: profile.isPublic,
      slug: profile.slug
    }
  });

  return profile;
}

export async function getAccountOverviewData(userId: string): Promise<AccountOverviewData> {
  const [user, orders, musicPurchases, notificationsUnread, wallet, sessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: {
        id: userId
      },
      include: {
        profile: true
      }
    }),
    prisma.order.count({
      where: {
        userId
      }
    }),
    prisma.digitalTrackPurchase.count({
      where: {
        buyerId: userId,
        status: "paid"
      }
    }),
    prisma.notification.count({
      where: {
        readAt: null,
        userId
      }
    }),
    prisma.starWallet.findUnique({
      where: {
        userId
      }
    }),
    prisma.authSession.count({
      where: {
        expiresAt: {
          gt: new Date()
        },
        revokedAt: null,
        userId
      }
    })
  ]);

  return {
    displayName: user.displayName,
    email: user.email,
    profileIsPublic: user.profile?.isPublic ?? true,
    profileSlug: user.profile?.slug ?? normalizeSlug(user.displayName, user.displayName),
    stats: {
      musicPurchases,
      notificationsUnread,
      orders,
      rewardsBalance: wallet?.balance ?? 0,
      sessions
    }
  };
}

function toNotificationRow(notification: {
  id: string;
  body: string | null;
  createdAt: Date;
  readAt: Date | null;
  title: string;
  type: string;
}): AccountNotificationRow {
  return {
    body: notification.body,
    createdAt: notification.createdAt.toISOString(),
    id: notification.id,
    readAt: notification.readAt?.toISOString() ?? null,
    title: notification.title,
    type: notification.type
  };
}

export async function getAccountNotificationsData(userId: string): Promise<AccountNotificationsData> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });
  const rows = notifications.map(toNotificationRow);

  return {
    notifications: rows,
    stats: {
      read: rows.filter((notification) => notification.readAt).length,
      total: rows.length,
      unread: rows.filter((notification) => !notification.readAt).length
    }
  };
}

export async function markAccountNotificationRead(userId: string, notificationId: string) {
  if (!notificationId) {
    throw new Error("Missing notification.");
  }

  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      readAt: null,
      userId
    },
    data: {
      readAt: new Date()
    }
  });
}

export async function markAllAccountNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      readAt: null,
      userId
    },
    data: {
      readAt: new Date()
    }
  });
}

export async function getAccountSettingsData(userId: string): Promise<AccountSettingsData> {
  const [user, activeSessions, unreadNotifications] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: {
        id: userId
      },
      include: {
        profile: true,
        roles: {
          include: {
            role: true
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    }),
    prisma.authSession.count({
      where: {
        expiresAt: {
          gt: new Date()
        },
        revokedAt: null,
        userId
      }
    }),
    prisma.notification.count({
      where: {
        readAt: null,
        userId
      }
    })
  ]);

  return {
    activeSessions,
    displayName: user.displayName,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    profileIsPublic: user.profile?.isPublic ?? true,
    profileSlug: user.profile?.slug ?? normalizeSlug(user.displayName, user.displayName),
    roles: normalizeRoles(user.roles.map((userRole) => userRole.role.name)),
    status: user.status,
    unreadNotifications
  };
}
