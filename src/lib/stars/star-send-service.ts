import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { publishChatRoomChanged } from "@/lib/chat/chat-realtime";
import { assertUserCanPostInChat } from "@/lib/chat/moderation-service";
import { pruneExpiredChatHistory } from "@/lib/chat/chat-service";
import type { StarAlertSettings } from "@/lib/stars/star-alert-settings";
import { getStarAlertSettings } from "@/lib/stars/star-alert-settings-service";
import { normalizeLiveStarSendAmount } from "@/lib/stars/star-send-core";
import { syncStreamProviderSnapshot } from "@/lib/stream/stream-session-sync-service";

export type LiveStarSupportData = {
  alertSettings: StarAlertSettings;
  latestSend: {
    id: string;
    amount: number;
    createdAt: string;
    displayName: string;
    note: string | null;
  } | null;
  recentSends: Array<{
    id: string;
    amount: number;
    createdAt: string;
    displayName: string;
    note: string | null;
  }>;
  leaderboard: Array<{
    displayName: string;
    stars: number;
    userId: string;
  }>;
  leaderboardPeriod: {
    endsAt: string;
    label: string;
    startsAt: string;
  };
  sendCount: number;
  sessionActive: boolean;
  totalStarsSent: number;
};

function normalizeNote(value: string | undefined) {
  const note = value?.trim() ?? "";

  if (!note) {
    return null;
  }

  if (note.length > 160) {
    throw new Error("Star message must be 160 characters or fewer.");
  }

  return note;
}

async function currentOpenStreamSession() {
  return prisma.streamSession.findFirst({
    where: {
      endedAt: null
    },
    orderBy: {
      startedAt: "desc"
    },
    select: {
      id: true
    }
  });
}

export function weeklyStarLeaderboardWindow(now = new Date()) {
  const utcDay = now.getUTCDay();
  const daysSinceMonday = (utcDay + 6) % 7;
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday, 0, 0, 0, 0));
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    endsAt,
    label: "This week",
    startsAt
  };
}

export async function getStarWalletBalance(userId: string | undefined) {
  if (!userId) {
    return 0;
  }

  const wallet = await prisma.starWallet.findUnique({
    where: {
      userId
    },
    select: {
      balance: true
    }
  });

  return wallet?.balance ?? 0;
}

export async function createLiveChatStarSend(
  roomId: string,
  userId: string,
  input: {
    amount: string;
    note?: string;
  }
) {
  await pruneExpiredChatHistory();
  await assertUserCanPostInChat(userId, roomId);

  const amount = normalizeLiveStarSendAmount(input.amount);
  const note = normalizeNote(input.note);

  await syncStreamProviderSnapshot().catch(() => {
    return null;
  });

  const result = await prisma.$transaction(async (tx) => {
    const room = await tx.chatRoom.findUniqueOrThrow({
      where: {
        id: roomId
      },
      select: {
        id: true,
        slug: true,
        type: true
      }
    });

    if (room.type !== "live") {
      throw new Error("Stars can only be sent in live chat.");
    }

    const wallet = await tx.starWallet.upsert({
      where: {
        userId
      },
      update: {},
      create: {
        balance: 0,
        userId
      }
    });

    if (wallet.balance < amount) {
      throw new Error("You do not have enough stars in your wallet.");
    }

    const updatedWallet = await tx.starWallet.updateMany({
      where: {
        id: wallet.id,
        balance: {
          gte: amount
        }
      },
      data: {
        balance: {
          decrement: amount
        }
      }
    });

    if (updatedWallet.count !== 1) {
      throw new Error("You do not have enough stars in your wallet.");
    }

    const [session, user] = await Promise.all([
      tx.streamSession.findFirst({
        where: {
          endedAt: null
        },
        orderBy: {
          startedAt: "desc"
        },
        select: {
          id: true
        }
      }),
      tx.user.findUniqueOrThrow({
        where: {
          id: userId
        },
        select: {
          displayName: true
        }
      })
    ]);
    const messageBody = note ? `${user.displayName} sent ${amount} stars: ${note}` : `${user.displayName} sent ${amount} stars`;
    const message = await tx.chatMessage.create({
      data: {
        body: messageBody,
        kind: "stars",
        roomId,
        userId
      }
    });
    const send = await tx.starSend.create({
      data: {
        amount,
        messageId: message.id,
        note,
        roomId,
        streamSessionId: session?.id ?? null,
        userId
      }
    });

    return {
      amount,
      messageId: message.id,
      roomSlug: room.slug,
      sendId: send.id,
      streamSessionId: session?.id ?? null
    };
  });

  await writeAuditLog({
    actorId: userId,
    action: "stars.send.live_chat",
    target: `star-send:${result.sendId}`,
    severity: "info",
    metadata: {
      amount: result.amount,
      roomSlug: result.roomSlug,
      streamSessionId: result.streamSessionId
    }
  });
  await publishChatRoomChanged(roomId, result.messageId);

  return result;
}

export async function getLiveStarSupportData(): Promise<LiveStarSupportData> {
  const session = await currentOpenStreamSession();
  const leaderboardPeriod = weeklyStarLeaderboardWindow();
  const where = {
    createdAt: {
      gte: leaderboardPeriod.startsAt,
      lt: leaderboardPeriod.endsAt
    },
    room: {
      type: "live"
    }
  };
  const [alertSettings, sends, aggregate, sendCount, recentSends] = await Promise.all([
    getStarAlertSettings(),
    prisma.starSend.groupBy({
      by: ["userId"],
      where,
      _sum: {
        amount: true
      },
      orderBy: {
        _sum: {
          amount: "desc"
        }
      },
      take: 20
    }),
    prisma.starSend.aggregate({
      where,
      _sum: {
        amount: true
      }
    }),
    prisma.starSend.count({
      where
    }),
    prisma.starSend.findMany({
      where,
      include: {
        user: {
          select: {
            displayName: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    })
  ]);
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: sends.map((send) => send.userId)
      }
    },
    select: {
      displayName: true,
      id: true
    }
  });
  const userById = new Map(users.map((user) => [user.id, user.displayName]));
  const recentSendRows = recentSends
    .map((send) => ({
      id: send.id,
      amount: send.amount,
      createdAt: send.createdAt.toISOString(),
      displayName: send.user.displayName,
      note: send.note
    }))
    .reverse();

  return {
    alertSettings,
    latestSend: recentSendRows.at(-1) ?? null,
    recentSends: recentSendRows,
    leaderboard: sends.map((send) => ({
      displayName: userById.get(send.userId) ?? "Viewer",
      stars: send._sum.amount ?? 0,
      userId: send.userId
    })),
    leaderboardPeriod: {
      endsAt: leaderboardPeriod.endsAt.toISOString(),
      label: leaderboardPeriod.label,
      startsAt: leaderboardPeriod.startsAt.toISOString()
    },
    sendCount,
    sessionActive: Boolean(session),
    totalStarsSent: aggregate._sum.amount ?? 0
  };
}
