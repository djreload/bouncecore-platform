import { Prisma } from "@prisma/client";
import { getNotificationDeliveryPreferencesForUser } from "@/lib/account/notification-preferences-service";
import { prisma } from "@/lib/db/prisma";
import { queueMobilePushForNotification } from "@/lib/mobile/account-notification-push-service";
import {
  directMessageActionUrl,
  directMessageNotificationContent
} from "@/lib/messages/direct-message-core";

export async function queueDirectMessageNotification(input: {
  body: string;
  conversationId: string;
  kind: string;
  messageId: string;
  recipientUserId: string;
  senderDisplayName: string;
}) {
  const content = directMessageNotificationContent(input);
  const dedupeKey = `${content.type}:${input.messageId}:user:${input.recipientUserId}`;
  let notification;

  try {
    notification = await prisma.notification.create({
      data: {
        actionUrl: directMessageActionUrl(input.conversationId, input.messageId),
        body: content.body,
        dedupeKey,
        title: content.title,
        type: content.type,
        userId: input.recipientUserId
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { duplicate: true, queuedPushDeliveryCount: 0 };
    }

    throw error;
  }

  const deliveryPreferences = await getNotificationDeliveryPreferencesForUser(input.recipientUserId, content.type);
  const push = deliveryPreferences.push
    ? await queueMobilePushForNotification({
        notificationId: notification.id,
        userId: input.recipientUserId
      })
    : null;

  return {
    duplicate: false,
    queuedPushDeliveryCount: push?.queuedPushDeliveryCount ?? 0
  };
}
