import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeRoles } from "@/lib/auth/role-normalize";
import type { Role } from "@/lib/auth/rbac";
import { makeProfileSlug } from "@/lib/auth/slugs";
import { prisma } from "@/lib/db/prisma";
import { normalizeOptionalProfileAvatarUrl } from "@/lib/media/media-service";

const publicDjRoles = ["streamer", "admin", "owner"];

export type StreamerProfileInput = {
  avatarUrl?: string;
  bio?: string;
  isPublic: boolean;
  location?: string;
  slug: string;
  websiteUrl?: string;
};

export type StreamerProfileData = {
  displayName: string;
  email: string;
  hasActiveStreamKey: boolean;
  profile: {
    avatarUrl: string | null;
    bio: string | null;
    isPublic: boolean;
    location: string | null;
    slug: string;
    websiteUrl: string | null;
  };
  roles: Role[];
  upcomingSchedules: PublicDjSchedule[];
};

export type PublicDjSchedule = {
  id: string;
  channelSlug: string;
  channelTitle: string;
  endsAt: string;
  startsAt: string;
  status: string;
  title: string;
};

export type PublicDjProfile = {
  avatarUrl: string | null;
  bio: string | null;
  displayName: string;
  email: string;
  hasActiveStreamKey: boolean;
  id: string;
  location: string | null;
  roles: Role[];
  schedules: PublicDjSchedule[];
  slug: string;
  websiteUrl: string | null;
};

function normalizeSlug(value: string, displayName: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || makeProfileSlug(displayName);
}

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

function normalizedUrl(value: string | undefined, maxLength: number) {
  const text = normalizedText(value, maxLength);

  if (!text) {
    return null;
  }

  const url = new URL(text);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URLs must start with http:// or https://.");
  }

  return url.toString();
}

function toSchedule(schedule: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  channel: {
    slug: string;
    title: string;
  };
}): PublicDjSchedule {
  return {
    id: schedule.id,
    channelSlug: schedule.channel.slug,
    channelTitle: schedule.channel.title,
    endsAt: schedule.endsAt.toISOString(),
    startsAt: schedule.startsAt.toISOString(),
    status: schedule.status,
    title: schedule.title
  };
}

function toPublicProfile(user: {
  id: string;
  displayName: string;
  email: string;
  profile: {
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
    slug: string;
    websiteUrl: string | null;
  } | null;
  roles: Array<{
    role: {
      name: string;
    };
  }>;
  streamKeys: Array<{
    id: string;
  }>;
  streamSchedules: Array<{
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    channel: {
      slug: string;
      title: string;
    };
  }>;
}): PublicDjProfile {
  return {
    id: user.id,
    avatarUrl: user.profile?.avatarUrl ?? null,
    bio: user.profile?.bio ?? null,
    displayName: user.displayName,
    email: user.email,
    hasActiveStreamKey: user.streamKeys.length > 0,
    location: user.profile?.location ?? null,
    roles: normalizeRoles(user.roles.map((userRole) => userRole.role.name)),
    schedules: user.streamSchedules.map(toSchedule),
    slug: user.profile?.slug ?? normalizeSlug(user.displayName, user.displayName),
    websiteUrl: user.profile?.websiteUrl ?? null
  };
}

function publicScheduleWhere(now: Date) {
  return {
    endsAt: {
      gte: now
    },
    status: {
      in: ["scheduled", "live"]
    }
  };
}

function publicUserWhere() {
  return {
    status: "active" as const,
    profile: {
      isPublic: true
    },
    roles: {
      some: {
        role: {
          name: {
            in: publicDjRoles
          }
        }
      }
    }
  };
}

export async function getStreamerProfileData(userId: string): Promise<StreamerProfileData> {
  const now = new Date();
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
      },
      streamKeys: {
        where: {
          revokedAt: null,
          status: "active"
        },
        select: {
          id: true
        },
        take: 1
      },
      streamSchedules: {
        where: publicScheduleWhere(now),
        orderBy: {
          startsAt: "asc"
        },
        include: {
          channel: {
            select: {
              slug: true,
              title: true
            }
          }
        },
        take: 5
      }
    }
  });

  return {
    displayName: user.displayName,
    email: user.email,
    hasActiveStreamKey: user.streamKeys.length > 0,
    profile: {
      avatarUrl: user.profile?.avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      isPublic: user.profile?.isPublic ?? true,
      location: user.profile?.location ?? null,
      slug: user.profile?.slug ?? normalizeSlug(user.displayName, user.displayName),
      websiteUrl: user.profile?.websiteUrl ?? null
    },
    roles: normalizeRoles(user.roles.map((userRole) => userRole.role.name)),
    upcomingSchedules: user.streamSchedules.map(toSchedule)
  };
}

export async function updateStreamerProfile(userId: string, input: StreamerProfileInput) {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId
    },
    select: {
      displayName: true
    }
  });
  const slug = normalizeSlug(input.slug, user.displayName);

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

  const profile = await prisma.profile.upsert({
    where: {
      userId
    },
    update: {
      avatarUrl: normalizeOptionalProfileAvatarUrl(input.avatarUrl),
      bio: normalizedText(input.bio, 600),
      isPublic: input.isPublic,
      location: normalizedText(input.location, 80),
      slug,
      websiteUrl: normalizedUrl(input.websiteUrl, 300)
    },
    create: {
      avatarUrl: normalizeOptionalProfileAvatarUrl(input.avatarUrl),
      bio: normalizedText(input.bio, 600),
      isPublic: input.isPublic,
      location: normalizedText(input.location, 80),
      slug,
      userId,
      websiteUrl: normalizedUrl(input.websiteUrl, 300)
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "profile.update",
    target: `profile:${profile.id}`,
    severity: "info",
    metadata: {
      isPublic: profile.isPublic,
      slug: profile.slug
    }
  });

  return profile;
}

export async function getPublicDjProfiles(): Promise<PublicDjProfile[]> {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: publicUserWhere(),
    orderBy: {
      displayName: "asc"
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
      },
      streamKeys: {
        where: {
          revokedAt: null,
          status: "active"
        },
        select: {
          id: true
        },
        take: 1
      },
      streamSchedules: {
        where: publicScheduleWhere(now),
        orderBy: {
          startsAt: "asc"
        },
        include: {
          channel: {
            select: {
              slug: true,
              title: true
            }
          }
        },
        take: 3
      }
    },
    take: 100
  });

  return users.map(toPublicProfile);
}

export async function getPublicDjProfileBySlug(slug: string): Promise<PublicDjProfile | null> {
  const now = new Date();
  const user = await prisma.user.findFirst({
    where: {
      ...publicUserWhere(),
      profile: {
        isPublic: true,
        slug
      }
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
      },
      streamKeys: {
        where: {
          revokedAt: null,
          status: "active"
        },
        select: {
          id: true
        },
        take: 1
      },
      streamSchedules: {
        where: publicScheduleWhere(now),
        orderBy: {
          startsAt: "asc"
        },
        include: {
          channel: {
            select: {
              slug: true,
              title: true
            }
          }
        },
        take: 10
      }
    }
  });

  return user ? toPublicProfile(user) : null;
}
