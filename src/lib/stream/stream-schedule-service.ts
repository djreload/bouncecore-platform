import { normalizeRoles } from "@/lib/auth/role-normalize";
import type { Role } from "@/lib/auth/rbac";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

export const streamScheduleStatusOptions = ["scheduled", "live", "completed", "cancelled"] as const;

export type StreamScheduleStatus = (typeof streamScheduleStatusOptions)[number];

export type StreamScheduleInput = {
  scheduleId?: string;
  channelId: string;
  hostUserId?: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  status: StreamScheduleStatus;
  timezoneOffsetMinutes?: number;
};

export type AdminStreamScheduleRow = {
  id: string;
  channelId: string;
  channelTitle: string;
  channelSlug: string;
  hostUserId: string | null;
  hostDisplayName: string | null;
  hostEmail: string | null;
  hostRoles: Role[];
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type AdminStreamScheduleChannelOption = {
  id: string;
  title: string;
  slug: string;
};

export type AdminStreamScheduleHostOption = {
  id: string;
  displayName: string;
  email: string;
  roles: Role[];
};

function assertScheduleStatus(status: string): asserts status is StreamScheduleStatus {
  if (!streamScheduleStatusOptions.includes(status as StreamScheduleStatus)) {
    throw new Error("Invalid schedule status.");
  }
}

function parseLocalDateTime(value: string, timezoneOffsetMinutes: number) {
  const [datePart, timePart] = value.split("T");
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = datePart?.split("-").map(Number) ?? [];
  const [hour = Number.NaN, minute = Number.NaN] = timePart?.split(":").map(Number) ?? [];

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return new Date(Number.NaN);
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute) + timezoneOffsetMinutes * 60_000);
}

function parseDateTime(value: string, label: string, timezoneOffsetMinutes?: number) {
  const trimmedValue = value.trim();
  const hasExplicitTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmedValue);
  const date =
    !hasExplicitTimezone && Number.isFinite(timezoneOffsetMinutes)
      ? parseLocalDateTime(trimmedValue, timezoneOffsetMinutes as number)
      : new Date(trimmedValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return date;
}

function normalizeScheduleInput(input: StreamScheduleInput) {
  assertScheduleStatus(input.status);

  const title = input.title.trim();
  const startsAt = parseDateTime(input.startsAt, "Start time", input.timezoneOffsetMinutes);
  const endsAt = parseDateTime(input.endsAt, "End time", input.timezoneOffsetMinutes);

  if (!input.channelId) {
    throw new Error("Choose a stream channel.");
  }

  if (title.length < 2 || title.length > 120) {
    throw new Error("Schedule title must be between 2 and 120 characters.");
  }

  if (endsAt <= startsAt) {
    throw new Error("End time must be after start time.");
  }

  return {
    scheduleId: input.scheduleId,
    channelId: input.channelId,
    hostUserId: input.hostUserId || null,
    title,
    description: input.description?.trim() || null,
    startsAt,
    endsAt,
    status: input.status
  };
}

function toScheduleRow(schedule: {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  channelId: string;
  hostUserId: string | null;
  channel: {
    title: string;
    slug: string;
  };
  host: {
    displayName: string;
    email: string;
    roles: Array<{
      role: {
        name: string;
      };
    }>;
  } | null;
}): AdminStreamScheduleRow {
  return {
    id: schedule.id,
    channelId: schedule.channelId,
    channelTitle: schedule.channel.title,
    channelSlug: schedule.channel.slug,
    hostUserId: schedule.hostUserId,
    hostDisplayName: schedule.host?.displayName ?? null,
    hostEmail: schedule.host?.email ?? null,
    hostRoles: normalizeRoles(schedule.host?.roles.map((userRole) => userRole.role.name) ?? []),
    title: schedule.title,
    description: schedule.description,
    startsAt: schedule.startsAt.toISOString(),
    endsAt: schedule.endsAt.toISOString(),
    status: schedule.status
  };
}

export async function getAdminStreamSchedulesData() {
  const [schedules, channels, hosts] = await Promise.all([
    prisma.streamSchedule.findMany({
      orderBy: {
        startsAt: "desc"
      },
      include: {
        channel: {
          select: {
            title: true,
            slug: true
          }
        },
        host: {
          select: {
            displayName: true,
            email: true,
            roles: {
              include: {
                role: true
              },
              orderBy: {
                createdAt: "asc"
              }
            }
          }
        }
      },
      take: 100
    }),
    prisma.streamChannel.findMany({
      orderBy: {
        slug: "asc"
      },
      select: {
        id: true,
        title: true,
        slug: true
      }
    }),
    prisma.user.findMany({
      where: {
        status: {
          in: ["active", "pending"]
        },
        roles: {
          some: {
            role: {
              name: {
                in: ["streamer", "admin", "owner"]
              }
            }
          }
        }
      },
      orderBy: {
        displayName: "asc"
      },
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
      take: 100
    })
  ]);
  const now = new Date();

  return {
    stats: {
      total: schedules.length,
      upcoming: schedules.filter((schedule) => schedule.startsAt >= now && schedule.status === "scheduled").length,
      live: schedules.filter((schedule) => schedule.status === "live").length,
      cancelled: schedules.filter((schedule) => schedule.status === "cancelled").length
    },
    schedules: schedules.map(toScheduleRow),
    channels: channels.map<AdminStreamScheduleChannelOption>((channel) => ({
      id: channel.id,
      title: channel.title,
      slug: channel.slug
    })),
    hosts: hosts.map<AdminStreamScheduleHostOption>((host) => ({
      id: host.id,
      displayName: host.displayName,
      email: host.email,
      roles: normalizeRoles(host.roles.map((userRole) => userRole.role.name))
    }))
  };
}

export async function createStreamSchedule(input: StreamScheduleInput, actorId: string) {
  const scheduleInput = normalizeScheduleInput(input);
  const schedule = await prisma.streamSchedule.create({
    data: {
      channelId: scheduleInput.channelId,
      hostUserId: scheduleInput.hostUserId,
      title: scheduleInput.title,
      description: scheduleInput.description,
      startsAt: scheduleInput.startsAt,
      endsAt: scheduleInput.endsAt,
      status: scheduleInput.status
    }
  });

  await writeAuditLog({
    actorId,
    action: "stream.schedule.create",
    target: `stream-schedule:${schedule.id}`,
    severity: "info",
    metadata: {
      channelId: schedule.channelId,
      hostUserId: schedule.hostUserId,
      startsAt: schedule.startsAt.toISOString(),
      status: schedule.status
    }
  });

  return schedule;
}

export async function updateStreamSchedule(input: StreamScheduleInput, actorId: string) {
  if (!input.scheduleId) {
    throw new Error("Missing schedule.");
  }

  const scheduleInput = normalizeScheduleInput(input);
  const existing = await prisma.streamSchedule.findUniqueOrThrow({
    where: {
      id: input.scheduleId
    }
  });
  const schedule = await prisma.streamSchedule.update({
    where: {
      id: input.scheduleId
    },
    data: {
      channelId: scheduleInput.channelId,
      hostUserId: scheduleInput.hostUserId,
      title: scheduleInput.title,
      description: scheduleInput.description,
      startsAt: scheduleInput.startsAt,
      endsAt: scheduleInput.endsAt,
      status: scheduleInput.status
    }
  });

  await writeAuditLog({
    actorId,
    action: "stream.schedule.update",
    target: `stream-schedule:${schedule.id}`,
    severity: existing.status !== schedule.status ? "warning" : "info",
    metadata: {
      channelId: schedule.channelId,
      hostUserId: schedule.hostUserId,
      startsAt: schedule.startsAt.toISOString(),
      status: schedule.status,
      previousStatus: existing.status
    }
  });

  return schedule;
}

export async function cancelStreamSchedule(scheduleId: string, actorId: string) {
  if (!scheduleId) {
    throw new Error("Missing schedule.");
  }

  const schedule = await prisma.streamSchedule.update({
    where: {
      id: scheduleId
    },
    data: {
      status: "cancelled"
    }
  });

  await writeAuditLog({
    actorId,
    action: "stream.schedule.cancel",
    target: `stream-schedule:${schedule.id}`,
    severity: "warning",
    metadata: {
      channelId: schedule.channelId,
      startsAt: schedule.startsAt.toISOString()
    }
  });

  return schedule;
}
