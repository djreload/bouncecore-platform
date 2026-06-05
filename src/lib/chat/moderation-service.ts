import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeRoles } from "@/lib/auth/role-normalize";
import type { Role } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

export const chatReportReasons = ["spam", "harassment", "hate", "explicit", "copyright", "other"] as const;
export const chatReportStatuses = ["open", "reviewing", "resolved", "dismissed"] as const;
export const chatBanDurations = ["1h", "24h", "7d", "30d", "permanent"] as const;

export type ChatReportReason = (typeof chatReportReasons)[number];
export type ChatReportStatus = (typeof chatReportStatuses)[number];
export type ChatBanDuration = (typeof chatBanDurations)[number];

export type ChatReportInput = {
  messageId: string;
  notes?: string;
  reason: string;
};

export type ChatReportStatusInput = {
  reportId: string;
  resolutionNote?: string;
  status: string;
};

export type ChatBanInput = {
  duration: string;
  notes?: string;
  reason: string;
  roomId?: string;
  userId: string;
};

export type ActiveChatBan = {
  expiresAt: string | null;
  id: string;
  reason: string;
  roomName: string | null;
};

export type AdminReportsData = {
  reports: Array<{
    createdAt: string;
    id: string;
    mediaPreviewUrl: string | null;
    messageBody: string | null;
    messageDeletedAt: string | null;
    messageId: string | null;
    messageKind: string | null;
    notes: string | null;
    reason: string;
    reporterDisplayName: string;
    reporterEmail: string | null;
    resolutionNote: string | null;
    resolvedAt: string | null;
    resolvedByDisplayName: string | null;
    roomName: string;
    roomSlug: string | null;
    status: string;
    targetDisplayName: string;
    targetEmail: string | null;
    targetUserId: string | null;
  }>;
  stats: {
    dismissed: number;
    open: number;
    resolved: number;
    reviewing: number;
    total: number;
  };
};

export type AdminBansData = {
  bans: Array<{
    active: boolean;
    createdAt: string;
    createdByDisplayName: string | null;
    expiresAt: string | null;
    id: string;
    notes: string | null;
    reason: string;
    revokedAt: string | null;
    revokedByDisplayName: string | null;
    roomName: string | null;
    roomSlug: string | null;
    userDisplayName: string;
    userEmail: string;
    userId: string;
  }>;
  rooms: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  stats: {
    active: number;
    expired: number;
    permanent: number;
    revoked: number;
    total: number;
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

function assertReportReason(value: string): asserts value is ChatReportReason {
  if (!chatReportReasons.includes(value as ChatReportReason)) {
    throw new Error("Choose a valid report reason.");
  }
}

function assertReportStatus(value: string): asserts value is ChatReportStatus {
  if (!chatReportStatuses.includes(value as ChatReportStatus)) {
    throw new Error("Choose a valid report status.");
  }
}

function assertBanDuration(value: string): asserts value is ChatBanDuration {
  if (!chatBanDurations.includes(value as ChatBanDuration)) {
    throw new Error("Choose a valid ban duration.");
  }
}

function banExpiresAt(duration: ChatBanDuration) {
  if (duration === "permanent") {
    return null;
  }

  const hoursByDuration: Record<Exclude<ChatBanDuration, "permanent">, number> = {
    "1h": 1,
    "24h": 24,
    "7d": 24 * 7,
    "30d": 24 * 30
  };

  return new Date(Date.now() + hoursByDuration[duration] * 60 * 60 * 1000);
}

function isActiveBan(ban: { expiresAt: Date | null; revokedAt: Date | null }) {
  return !ban.revokedAt && (!ban.expiresAt || ban.expiresAt > new Date());
}

function toRoleList(values: string[]) {
  return normalizeRoles(values);
}

function activeBanWhere(userId: string, roomId?: string | null) {
  return {
    AND: [
      {
        OR: [
          {
            expiresAt: null
          },
          {
            expiresAt: {
              gt: new Date()
            }
          }
        ]
      },
      ...(roomId
        ? [
            {
              OR: [
                {
                  roomId: null
                },
                {
                  roomId
                }
              ]
            }
          ]
        : [])
    ],
    revokedAt: null,
    userId
  };
}

export async function getActiveChatBan(userId: string, roomId: string): Promise<ActiveChatBan | null> {
  const ban = await prisma.chatBan.findFirst({
    where: activeBanWhere(userId, roomId),
    include: {
      room: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!ban) {
    return null;
  }

  return {
    expiresAt: ban.expiresAt?.toISOString() ?? null,
    id: ban.id,
    reason: ban.reason,
    roomName: ban.room?.name ?? null
  };
}

export async function assertUserCanPostInChat(userId: string, roomId: string) {
  const ban = await getActiveChatBan(userId, roomId);

  if (ban) {
    throw new Error(
      ban.expiresAt
        ? `You are banned from chat until ${new Date(ban.expiresAt).toLocaleString("en-GB")}.`
        : "You are permanently banned from chat."
    );
  }
}

export async function createChatReport(input: ChatReportInput, reporterId: string) {
  const reason = input.reason.trim();
  assertReportReason(reason);

  const message = await prisma.chatMessage.findUniqueOrThrow({
    where: {
      id: input.messageId
    },
    include: {
      room: true
    }
  });

  if (message.userId === reporterId) {
    throw new Error("You cannot report your own message.");
  }

  const existingOpenReport = await prisma.chatReport.findFirst({
    where: {
      messageId: message.id,
      reporterId,
      status: {
        in: ["open", "reviewing"]
      }
    },
    select: {
      id: true
    }
  });

  if (existingOpenReport) {
    throw new Error("You already have an open report for this message.");
  }

  const [reporter, targetUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: {
        id: reporterId
      },
      select: {
        displayName: true
      }
    }),
    message.userId
      ? prisma.user.findUnique({
          where: {
            id: message.userId
          },
          select: {
            displayName: true
          }
        })
      : null
  ]);

  const report = await prisma.chatReport.create({
    data: {
      mediaPreviewUrl: message.mediaPreviewUrl,
      messageBody: message.kind === "gif" ? message.mediaAlt ?? message.body : message.body,
      messageId: message.id,
      messageKind: message.kind,
      notes: normalizedText(input.notes, 500),
      reason,
      reporterDisplayName: reporter.displayName,
      reporterId,
      roomId: message.roomId,
      targetDisplayName: targetUser?.displayName ?? "Guest",
      targetUserId: message.userId
    }
  });

  await writeAuditLog({
    actorId: reporterId,
    action: "chat.report.create",
    target: `chat-report:${report.id}`,
    severity: "warning",
    metadata: {
      messageId: message.id,
      reason,
      roomSlug: message.room.slug,
      targetUserId: message.userId
    }
  });

  return report;
}

export async function getAdminReportsData(): Promise<AdminReportsData> {
  const reports = await prisma.chatReport.findMany({
    include: {
      message: {
        select: {
          deletedAt: true
        }
      },
      reporter: {
        select: {
          displayName: true,
          email: true
        }
      },
      resolvedBy: {
        select: {
          displayName: true
        }
      },
      room: true,
      targetUser: {
        select: {
          displayName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });
  const stats = reports.reduce<AdminReportsData["stats"]>(
    (counts, report) => ({
      ...counts,
      [report.status]: (counts[report.status as ChatReportStatus] ?? 0) + 1,
      total: counts.total + 1
    }),
    {
      dismissed: 0,
      open: 0,
      resolved: 0,
      reviewing: 0,
      total: 0
    }
  );

  return {
    reports: reports.map((report) => ({
      createdAt: report.createdAt.toISOString(),
      id: report.id,
      mediaPreviewUrl: report.mediaPreviewUrl,
      messageBody: report.messageBody,
      messageDeletedAt: report.message?.deletedAt?.toISOString() ?? null,
      messageId: report.messageId,
      messageKind: report.messageKind,
      notes: report.notes,
      reason: report.reason,
      reporterDisplayName: report.reporter?.displayName ?? report.reporterDisplayName ?? "Unknown reporter",
      reporterEmail: report.reporter?.email ?? null,
      resolutionNote: report.resolutionNote,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      resolvedByDisplayName: report.resolvedBy?.displayName ?? null,
      roomName: report.room?.name ?? "Deleted room",
      roomSlug: report.room?.slug ?? null,
      status: report.status,
      targetDisplayName: report.targetUser?.displayName ?? report.targetDisplayName ?? "Guest",
      targetEmail: report.targetUser?.email ?? null,
      targetUserId: report.targetUserId
    })),
    stats
  };
}

export async function updateChatReportStatus(input: ChatReportStatusInput, actorId: string) {
  const status = input.status.trim();
  assertReportStatus(status);

  const resolutionNote = normalizedText(input.resolutionNote, 500);
  const resolved = status === "resolved" || status === "dismissed";
  const report = await prisma.chatReport.update({
    where: {
      id: input.reportId
    },
    data: {
      resolutionNote: resolved ? resolutionNote : null,
      resolvedAt: resolved ? new Date() : null,
      resolvedById: resolved ? actorId : null,
      status
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.report.status_update",
    target: `chat-report:${report.id}`,
    severity: status === "dismissed" ? "info" : "warning",
    metadata: {
      status
    }
  });

  return report;
}

export async function hideReportedMessage(reportId: string, actorId: string) {
  const report = await prisma.chatReport.findUniqueOrThrow({
    where: {
      id: reportId
    },
    include: {
      message: true,
      room: true
    }
  });

  if (!report.messageId || !report.message) {
    throw new Error("The reported message is no longer available.");
  }

  const messageId = report.messageId;

  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.update({
      where: {
        id: messageId
      },
      data: {
        deletedAt: report.message?.deletedAt ?? new Date()
      }
    });

    await tx.chatReport.update({
      where: {
        id: report.id
      },
      data: {
        resolutionNote: "Reported message hidden by moderation.",
        resolvedAt: new Date(),
        resolvedById: actorId,
        status: "resolved"
      }
    });
  });

  await writeAuditLog({
    actorId,
    action: "chat.report.hide_message",
    target: `chat-report:${report.id}`,
    severity: "warning",
    metadata: {
      messageId: report.messageId,
      roomSlug: report.room?.slug
    }
  });
}

export async function getAdminBansData(): Promise<AdminBansData> {
  const [bans, rooms, users] = await Promise.all([
    prisma.chatBan.findMany({
      include: {
        createdBy: {
          select: {
            displayName: true
          }
        },
        revokedBy: {
          select: {
            displayName: true
          }
        },
        room: true,
        user: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    }),
    prisma.chatRoom.findMany({
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    }),
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
      },
      take: 200
    })
  ]);
  const banRows = bans.map((ban) => ({
    active: isActiveBan(ban),
    createdAt: ban.createdAt.toISOString(),
    createdByDisplayName: ban.createdBy?.displayName ?? null,
    expiresAt: ban.expiresAt?.toISOString() ?? null,
    id: ban.id,
    notes: ban.notes,
    reason: ban.reason,
    revokedAt: ban.revokedAt?.toISOString() ?? null,
    revokedByDisplayName: ban.revokedBy?.displayName ?? null,
    roomName: ban.room?.name ?? null,
    roomSlug: ban.room?.slug ?? null,
    userDisplayName: ban.user.displayName,
    userEmail: ban.user.email,
    userId: ban.userId
  }));

  return {
    bans: banRows,
    rooms,
    stats: {
      active: banRows.filter((ban) => ban.active).length,
      expired: banRows.filter((ban) => !ban.revokedAt && ban.expiresAt && new Date(ban.expiresAt) <= new Date()).length,
      permanent: banRows.filter((ban) => ban.active && !ban.expiresAt).length,
      revoked: banRows.filter((ban) => ban.revokedAt).length,
      total: banRows.length
    },
    users: users.map((user) => ({
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      roles: toRoleList(user.roles.map((userRole) => userRole.role.name)),
      status: user.status
    }))
  };
}

export async function createChatBan(input: ChatBanInput, actorId: string) {
  const duration = input.duration.trim();
  assertBanDuration(duration);

  const reason = normalizedRequiredText(input.reason, 160, "Reason");
  const roomId = input.roomId?.trim() || null;
  const expiresAt = banExpiresAt(duration);
  const [actor, targetUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: {
        id: actorId
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    }),
    prisma.user.findUniqueOrThrow({
      where: {
        id: input.userId
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })
  ]);
  const actorRoles = toRoleList(actor.roles.map((userRole) => userRole.role.name));
  const targetRoles = toRoleList(targetUser.roles.map((userRole) => userRole.role.name));

  if (targetUser.id === actorId) {
    throw new Error("You cannot chat-ban your own account.");
  }

  if (targetRoles.includes("owner") && !actorRoles.includes("owner")) {
    throw new Error("Only server owners can chat-ban server owners.");
  }

  if (roomId) {
    await prisma.chatRoom.findUniqueOrThrow({
      where: {
        id: roomId
      },
      select: {
        id: true
      }
    });
  }

  const existing = await prisma.chatBan.findFirst({
    where: {
      revokedAt: null,
      roomId,
      userId: targetUser.id,
      OR: [
        {
          expiresAt: null
        },
        {
          expiresAt: {
            gt: new Date()
          }
        }
      ]
    },
    select: {
      id: true
    }
  });

  if (existing) {
    throw new Error("That user already has an active chat ban for this scope.");
  }

  const ban = await prisma.chatBan.create({
    data: {
      createdById: actorId,
      expiresAt,
      notes: normalizedText(input.notes, 500),
      reason,
      roomId,
      userId: targetUser.id
    }
  });

  await prisma.notification.create({
    data: {
      body: expiresAt
        ? `Your chat access is restricted until ${expiresAt.toLocaleString("en-GB")}. Reason: ${reason}`
        : `Your chat access is permanently restricted. Reason: ${reason}`,
      title: "Chat access restricted",
      type: "moderation.chat_ban",
      userId: targetUser.id
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.ban.create",
    target: `chat-ban:${ban.id}`,
    severity: "warning",
    metadata: {
      duration,
      expiresAt: expiresAt?.toISOString() ?? null,
      roomId,
      targetUserId: targetUser.id
    }
  });

  return ban;
}

export async function revokeChatBan(banId: string, actorId: string) {
  const ban = await prisma.chatBan.update({
    where: {
      id: banId
    },
    data: {
      revokedAt: new Date(),
      revokedById: actorId
    }
  });

  await writeAuditLog({
    actorId,
    action: "chat.ban.revoke",
    target: `chat-ban:${ban.id}`,
    severity: "info",
    metadata: {
      targetUserId: ban.userId
    }
  });

  return ban;
}
