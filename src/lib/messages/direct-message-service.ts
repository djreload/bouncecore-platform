import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { cleanupDeletedManagedUploads } from "@/lib/media/upload-cleanup-service";
import { saveTemporaryChatAttachment } from "@/lib/media/media-service";
import { chatReportReasons, type ChatReportReason } from "@/lib/chat/moderation-service";
import {
  directConversationPair,
  directMessageSendIntervalMs,
  normalizeDirectMessageBody
} from "@/lib/messages/direct-message-core";
import { queueDirectMessageNotification } from "@/lib/messages/direct-message-notification-service";

const directMessagePageSize = 100;

export type DirectMessageUserSummary = {
  avatarUrl: string | null;
  displayName: string;
  id: string;
  profileSlug: string | null;
};

export type DirectMessageSummary = {
  body: string;
  createdAt: string;
  deletedAt: string | null;
  id: string;
  kind: string;
  mediaAlt: string | null;
  mediaPreviewUrl: string | null;
  mediaUrl: string | null;
  sender: DirectMessageUserSummary;
};

export type DirectConversationSummary = {
  createdAt: string;
  id: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  otherUser: DirectMessageUserSummary;
  unreadCount: number;
};

export type DirectMessagingData = {
  conversations: DirectConversationSummary[];
  messages: DirectMessageSummary[];
  recipients: DirectMessageUserSummary[];
  selectedBlockState: {
    blockedByCurrentUser: boolean;
    blockedCurrentUser: boolean;
  };
  selectedConversationId: string | null;
};

const conversationUserSelect = {
  displayName: true,
  id: true,
  profile: {
    select: {
      avatarUrl: true,
      slug: true
    }
  }
} as const;

function toUserSummary(user: {
  displayName: string;
  id: string;
  profile: { avatarUrl: string | null; slug: string } | null;
}): DirectMessageUserSummary {
  return {
    avatarUrl: user.profile?.avatarUrl ?? null,
    displayName: user.displayName,
    id: user.id,
    profileSlug: user.profile?.slug ?? null
  };
}

function otherConversationUser<T extends { userOneId: string; userOne: Parameters<typeof toUserSummary>[0]; userTwo: Parameters<typeof toUserSummary>[0] }>(
  conversation: T,
  userId: string
) {
  return toUserSummary(conversation.userOneId === userId ? conversation.userTwo : conversation.userOne);
}

function participantFilter(userId: string) {
  return {
    OR: [{ userOneId: userId }, { userTwoId: userId }]
  };
}

function otherParticipantId(conversation: { userOneId: string; userTwoId: string }, userId: string) {
  return conversation.userOneId === userId ? conversation.userTwoId : conversation.userOneId;
}

function normalizeReportNotes(value: string | undefined) {
  const notes = value?.trim().replace(/\r\n?/g, "\n") ?? "";
  return notes ? notes.slice(0, 500) : null;
}

function assertReportReason(value: string): asserts value is ChatReportReason {
  if (!chatReportReasons.includes(value as ChatReportReason)) {
    throw new Error("Choose a valid report reason.");
  }
}

function messagePreview(message: { body: string; kind: string } | undefined) {
  if (!message) {
    return "Conversation ready";
  }

  const text = message.body.replace(/\s+/g, " ").trim();

  if (text) {
    return text.length > 72 ? `${text.slice(0, 69)}...` : text;
  }

  return message.kind === "attachment-image" ? "Image" : message.kind === "attachment-file" ? "ZIP file" : "Message";
}

export async function startDirectConversation(userId: string, targetUserId: string) {
  const pair = directConversationPair(userId, targetUserId);
  const existing = await prisma.directConversation.findUnique({ where: { pairKey: pair.pairKey } });

  if (existing) {
    return existing;
  }

  const [target, blockCount] = await Promise.all([
    prisma.user.findFirst({
      select: { id: true },
      where: {
        emailVerifiedAt: { not: null },
        id: targetUserId,
        status: "active"
      }
    }),
    prisma.directMessageBlock.count({
      where: {
        OR: [
          { blockedUserId: targetUserId, blockerId: userId },
          { blockedUserId: userId, blockerId: targetUserId }
        ]
      }
    })
  ]);

  if (blockCount) {
    throw new Error("Private messages are blocked between these accounts.");
  }

  if (!target) {
    throw new Error("That user is not available for private messages.");
  }

  return prisma.directConversation.upsert({ create: pair, update: {}, where: { pairKey: pair.pairKey } });
}

async function directMessageBlocksBetween(firstUserId: string, secondUserId: string) {
  return prisma.directMessageBlock.findMany({
    select: { blockedUserId: true, blockerId: true },
    where: {
      OR: [
        { blockedUserId: secondUserId, blockerId: firstUserId },
        { blockedUserId: firstUserId, blockerId: secondUserId }
      ]
    }
  });
}

async function requireConversationParticipant(conversationId: string, userId: string) {
  const conversation = await prisma.directConversation.findFirst({
    include: {
      userOne: { select: conversationUserSelect },
      userTwo: { select: conversationUserSelect }
    },
    where: {
      id: conversationId,
      ...participantFilter(userId)
    }
  });

  if (!conversation) {
    throw new Error("Private conversation was not found.");
  }

  return conversation;
}

async function markConversationRead(
  conversation: {
    id: string;
    lastMessageAt: Date | null;
    userOneId: string;
    userOneReadAt: Date | null;
    userTwoReadAt: Date | null;
  },
  userId: string
) {
  const readAt = conversation.userOneId === userId ? conversation.userOneReadAt : conversation.userTwoReadAt;

  if (!conversation.lastMessageAt || (readAt && readAt >= conversation.lastMessageAt)) {
    return;
  }

  await prisma.directConversation.update({
    data: conversation.userOneId === userId ? { userOneReadAt: new Date() } : { userTwoReadAt: new Date() },
    where: { id: conversation.id }
  });
}

export async function getDirectMessagingData(userId: string, requestedConversationId?: string | null): Promise<DirectMessagingData> {
  const [conversations, recipients, userBlocks] = await Promise.all([
    prisma.directConversation.findMany({
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          select: { body: true, kind: true },
          take: 1,
          where: { deletedAt: null }
        },
        userOne: { select: conversationUserSelect },
        userTwo: { select: conversationUserSelect }
      },
      orderBy: [{ lastMessageAt: { nulls: "last", sort: "desc" } }, { createdAt: "desc" }],
      where: participantFilter(userId)
    }),
    prisma.user.findMany({
      orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
      select: conversationUserSelect,
      where: {
        emailVerifiedAt: { not: null },
        id: { not: userId },
        status: "active"
      }
    }),
    prisma.directMessageBlock.findMany({
      select: { blockedUserId: true, blockerId: true },
      where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] }
    })
  ]);
  const selectedConversation =
    conversations.find((conversation) => conversation.id === requestedConversationId) ?? conversations[0] ?? null;

  if (selectedConversation) {
    await markConversationRead(selectedConversation, userId);
  }

  const selectedOtherUserId = selectedConversation ? otherParticipantId(selectedConversation, userId) : null;
  const selectedBlockState = {
    blockedByCurrentUser: Boolean(
      selectedOtherUserId && userBlocks.some((block) => block.blockerId === userId && block.blockedUserId === selectedOtherUserId)
    ),
    blockedCurrentUser: Boolean(
      selectedOtherUserId && userBlocks.some((block) => block.blockerId === selectedOtherUserId && block.blockedUserId === userId)
    )
  };
  const blockedRecipientIds = new Set(
    userBlocks.map((block) => (block.blockerId === userId ? block.blockedUserId : block.blockerId))
  );

  const [messages, unreadCounts] = await Promise.all([
    selectedConversation
      ? prisma.directMessage.findMany({
          include: {
            sender: { select: conversationUserSelect }
          },
          orderBy: { createdAt: "desc" },
          take: directMessagePageSize,
          where: {
            conversationId: selectedConversation.id,
            deletedAt: null
          }
        })
      : Promise.resolve([]),
    Promise.all(
      conversations.map((conversation) => {
        const readAt = conversation.userOneId === userId ? conversation.userOneReadAt : conversation.userTwoReadAt;

        return prisma.directMessage.count({
          where: {
            conversationId: conversation.id,
            createdAt: readAt ? { gt: readAt } : undefined,
            deletedAt: null,
            senderId: { not: userId }
          }
        });
      })
    )
  ]);

  return {
    conversations: conversations.map((conversation, index) => ({
      createdAt: conversation.createdAt.toISOString(),
      id: conversation.id,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: messagePreview(conversation.messages[0]),
      otherUser: otherConversationUser(conversation, userId),
      unreadCount: conversation.id === selectedConversation?.id ? 0 : unreadCounts[index]
    })),
    messages: messages.reverse().map((message) => ({
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      deletedAt: message.deletedAt?.toISOString() ?? null,
      id: message.id,
      kind: message.kind,
      mediaAlt: message.mediaAlt,
      mediaPreviewUrl: message.mediaPreviewUrl,
      mediaUrl: message.mediaUrl,
      sender: toUserSummary(message.sender)
    })),
    recipients: recipients.filter((recipient) => !blockedRecipientIds.has(recipient.id)).map(toUserSummary),
    selectedBlockState,
    selectedConversationId: selectedConversation?.id ?? null
  };
}

export async function sendDirectMessage(input: {
  body: unknown;
  conversationId: string;
  file?: File | null;
  senderUserId: string;
}) {
  const body = normalizeDirectMessageBody(input.body);
  const conversation = await requireConversationParticipant(input.conversationId, input.senderUserId);
  const recipientUserId = otherParticipantId(conversation, input.senderUserId);
  const blocks = await directMessageBlocksBetween(input.senderUserId, recipientUserId);

  if (blocks.length) {
    const blockedBySender = blocks.some(
      (block) => block.blockerId === input.senderUserId && block.blockedUserId === recipientUserId
    );

    throw new Error(
      blockedBySender
        ? "Unblock this user before sending another private message."
        : "This user is not accepting private messages from you."
    );
  }

  const latest = await prisma.directMessage.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    where: { senderId: input.senderUserId }
  });

  if (latest && Date.now() - latest.createdAt.getTime() < directMessageSendIntervalMs) {
    throw new Error("Please wait a moment before sending another private message.");
  }

  const attachment = input.file?.size ? await saveTemporaryChatAttachment(input.file) : null;

  if (!body && !attachment) {
    throw new Error("Write a message or choose an image or ZIP file.");
  }

  const now = new Date();

  try {
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
        data: {
          body: body || attachment?.filename || "",
          conversationId: conversation.id,
          kind: attachment ? (attachment.kind === "image" ? "attachment-image" : "attachment-file") : "text",
          mediaAlt: attachment?.filename ?? null,
          mediaPreviewUrl: attachment?.kind === "image" ? attachment.url : null,
          mediaSource: attachment ? "direct_message_attachment" : null,
          mediaSourceId: attachment?.contentType ?? null,
          mediaUrl: attachment?.url ?? null,
          senderId: input.senderUserId
        }
      });

      await tx.directConversation.update({
        data: {
          lastMessageAt: now,
          ...(conversation.userOneId === input.senderUserId ? { userOneReadAt: now } : { userTwoReadAt: now })
        },
        where: { id: conversation.id }
      });

      return created;
    });
    const recipient = conversation.userOneId === input.senderUserId ? conversation.userTwo : conversation.userOne;
    const sender = conversation.userOneId === input.senderUserId ? conversation.userOne : conversation.userTwo;

    try {
      await queueDirectMessageNotification({
        body: message.body,
        conversationId: conversation.id,
        kind: message.kind,
        messageId: message.id,
        recipientUserId: recipient.id,
        senderDisplayName: sender.displayName
      });
    } catch (error) {
      await writeAuditLog({
        action: "chat.direct_message.notification_failed",
        actorId: input.senderUserId,
        metadata: { error: error instanceof Error ? error.message : "Private message notification failed." },
        severity: "warning",
        target: `direct-message:${message.id}`
      }).catch(() => undefined);
    }

    return message;
  } catch (error) {
    if (attachment) {
      await cleanupDeletedManagedUploads([attachment.url]).catch(() => undefined);
    }

    throw error;
  }
}

export async function blockDirectMessageUser(conversationId: string, userId: string) {
  const conversation = await requireConversationParticipant(conversationId, userId);
  const blockedUserId = otherParticipantId(conversation, userId);
  const block = await prisma.directMessageBlock.upsert({
    create: { blockedUserId, blockerId: userId },
    update: {},
    where: { blockerId_blockedUserId: { blockedUserId, blockerId: userId } }
  });

  await writeAuditLog({
    action: "chat.direct_message.block",
    actorId: userId,
    metadata: { blockedUserId, conversationId },
    severity: "info",
    target: `user:${blockedUserId}`
  });

  return block;
}

export async function unblockDirectMessageUser(conversationId: string, userId: string) {
  const conversation = await requireConversationParticipant(conversationId, userId);
  const blockedUserId = otherParticipantId(conversation, userId);
  await prisma.directMessageBlock.deleteMany({ where: { blockedUserId, blockerId: userId } });

  await writeAuditLog({
    action: "chat.direct_message.unblock",
    actorId: userId,
    metadata: { blockedUserId, conversationId },
    severity: "info",
    target: `user:${blockedUserId}`
  });
}

export async function reportDirectMessageConversation(input: {
  conversationId: string;
  notes?: string;
  reason: string;
  reporterId: string;
}) {
  const reason = input.reason.trim();
  assertReportReason(reason);
  const conversation = await requireConversationParticipant(input.conversationId, input.reporterId);
  const targetUserId = otherParticipantId(conversation, input.reporterId);
  const existing = await prisma.chatReport.findFirst({
    select: { id: true },
    where: {
      directConversationId: conversation.id,
      reporterId: input.reporterId,
      status: { in: ["open", "reviewing"] },
      targetUserId
    }
  });

  if (existing) {
    throw new Error("You already have an open report for this private conversation.");
  }

  const latestTargetMessage = await prisma.directMessage.findFirst({
    orderBy: { createdAt: "desc" },
    where: { conversationId: conversation.id, deletedAt: null, senderId: targetUserId }
  });
  const reporter = conversation.userOneId === input.reporterId ? conversation.userOne : conversation.userTwo;
  const target = conversation.userOneId === input.reporterId ? conversation.userTwo : conversation.userOne;
  const report = await prisma.chatReport.create({
    data: {
      directConversationId: conversation.id,
      directMessageId: latestTargetMessage?.id ?? null,
      messageBody: latestTargetMessage?.body ?? "Private conversation report",
      messageKind: "direct-message",
      notes: normalizeReportNotes(input.notes),
      reason,
      reporterDisplayName: reporter.displayName,
      reporterId: input.reporterId,
      targetDisplayName: target.displayName,
      targetUserId
    }
  });

  await writeAuditLog({
    action: "chat.direct_message.report",
    actorId: input.reporterId,
    metadata: { conversationId: conversation.id, reason, targetUserId },
    severity: "warning",
    target: `chat-report:${report.id}`
  });

  return report;
}
