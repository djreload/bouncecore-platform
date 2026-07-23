"use server";

import { revalidatePath } from "next/cache";
import {
  clearChatRoomMessages,
  createChatGifMessage,
  createChatMessage,
  createChatStickerMessage,
  editOwnChatMessage,
  moderateChatMessage,
  toggleChatMessageReaction
} from "@/lib/chat/chat-service";
import { hasPermission, hasRole } from "@/lib/auth/rbac";
import { createChatBan, createChatReport } from "@/lib/chat/moderation-service";
import { createChatSheepThrow } from "@/lib/chat/sheep-throw-service";
import { getCurrentUser } from "@/lib/auth/session";
import { activateCoreFpsFromChat } from "@/lib/games/core-fps-invite-service";
import { createRaveWarChallenge } from "@/lib/rave-wars/rave-war-service";
import { createLiveChatStarSend } from "@/lib/stars/star-send-service";
import type { PublicChatActionState } from "@/app/chat/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function publicChatAction(
  _previousState: PublicChatActionState,
  formData: FormData
): Promise<PublicChatActionState> {
  const roomId = formString(formData, "roomId");
  const intent = formString(formData, "intent") || "text";
  const body = formString(formData, "body");
  const user = await getCurrentUser();

  if (!user) {
    return {
      intent,
      status: "error",
      message: "Sign in to send chat messages."
    };
  }

  if (!roomId) {
    return {
      intent,
      status: "error",
      message: "Choose a chat room before sending a message."
    };
  }

  try {
    let actionUrl: string | undefined;
    let invitedUserCount = 0;

    if (intent === "report") {
      await createChatReport(
        {
          messageId: formString(formData, "messageId"),
          notes: formString(formData, "reportNotes"),
          reason: formString(formData, "reason")
        },
        user.id
      );
    } else if (intent === "clear-room") {
      if (!hasRole(user, "admin") && !hasRole(user, "owner")) {
        throw new Error("Only admins and owners can clear chat.");
      }

      await clearChatRoomMessages(roomId, user.id);
    } else if (intent === "delete-message") {
      if (!hasPermission(user, "moderation.use")) {
        throw new Error("You do not have permission to remove chat messages.");
      }

      await moderateChatMessage(formString(formData, "messageId"), user.id);
    } else if (intent === "ban-user") {
      if (!hasPermission(user, "moderation.use")) {
        throw new Error("You do not have permission to ban chat users.");
      }

      await createChatBan(
        {
          duration: formString(formData, "duration") || "24h",
          notes: formString(formData, "banNotes"),
          reason: formString(formData, "banReason") || "Live chat rule violation",
          roomId,
          userId: formString(formData, "targetUserId")
        },
        user.id
      );
    } else if (intent === "gif") {
      await createChatGifMessage(roomId, user.id, {
        id: formString(formData, "gifId"),
        provider: formString(formData, "gifProvider"),
        url: formString(formData, "gifUrl"),
        previewUrl: formString(formData, "gifPreviewUrl"),
        alt: formString(formData, "gifAlt"),
        searchTerm: formString(formData, "gifQuery"),
        width: Number(formString(formData, "gifWidth")) || null,
        height: Number(formString(formData, "gifHeight")) || null
      });
    } else if (intent === "asset") {
      await createChatStickerMessage(roomId, user.id, formString(formData, "assetId"));
    } else if (intent === "reaction") {
      await toggleChatMessageReaction(formString(formData, "messageId"), user.id, formString(formData, "reactionKey"));
    } else if (intent === "edit-message") {
      await editOwnChatMessage(formString(formData, "messageId"), body, user.id);
    } else if (intent === "sheep") {
      await createChatSheepThrow(
        roomId,
        user.id,
        formString(formData, "messageId"),
        formString(formData, "throwSpriteId"),
        formString(formData, "targetUserId")
      );
    } else if (intent === "rave-war") {
      await createRaveWarChallenge(roomId, user.id, formString(formData, "targetUserId"));
    } else if (intent === "core-fps") {
      const activation = await activateCoreFpsFromChat(roomId, user.id);
      actionUrl = activation.actionUrl;
      invitedUserCount = activation.invitedUserCount;
    } else if (intent === "stars") {
      await createLiveChatStarSend(roomId, user.id, {
        amount: formString(formData, "amount"),
        note: formString(formData, "note")
      });
    } else {
      await createChatMessage(roomId, body, user.id, formString(formData, "effectId"), formString(formData, "replyToMessageId"));
    }

    revalidatePath("/chat");
    revalidatePath("/live");
    revalidatePath("/account/rewards");
    revalidatePath("/admin/stars");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/bans");
    revalidatePath("/admin/chatrooms");
    revalidatePath("/admin/audit-logs");

    return {
      actionUrl,
      intent,
      revision: Date.now(),
      status: "success",
      message:
        intent === "report"
          ? "Report sent to moderators."
          : intent === "clear-room"
            ? "Chat cleared."
          : intent === "delete-message"
            ? "Message removed from chat."
            : intent === "ban-user"
              ? "Chat ban created."
          : intent === "gif"
            ? "GIF sent."
            : intent === "asset"
              ? "Sticker sent."
              : intent === "reaction"
                ? "Reaction updated."
                : intent === "edit-message"
                  ? "Message updated."
                : intent === "sheep"
                  ? "Sheep thrown."
                : intent === "rave-war"
                  ? "Rave War challenge sent."
                  : intent === "core-fps"
                    ? invitedUserCount > 0
                      ? `Game started. ${invitedUserCount.toLocaleString("en-GB")} online ${invitedUserCount === 1 ? "chatter was" : "chatters were"} invited.`
                      : "Joining the active Core FPS game."
            : intent === "stars"
              ? "Stars sent to live chat."
              : "Message sent."
    };
  } catch (error) {
    if (intent === "report" || intent === "clear-room" || intent === "delete-message" || intent === "ban-user") {
      return {
        intent,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : intent === "clear-room"
              ? "Chat was not cleared."
            : intent === "delete-message"
              ? "Message was not removed."
              : intent === "ban-user"
                ? "Chat ban was not created."
                : "Report was not sent."
      };
    }

    return {
      intent,
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : intent === "gif"
            ? "GIF was not sent. Try another result."
            : intent === "asset"
              ? "Sticker was not sent."
              : intent === "reaction"
                ? "Reaction was not saved."
                : intent === "edit-message"
                  ? "Message was not updated."
                : intent === "sheep"
                  ? "Sheep was not thrown."
                : intent === "rave-war"
                  ? "Rave War challenge was not sent."
                  : intent === "core-fps"
                    ? "Core FPS could not be started."
            : intent === "stars"
              ? "Stars were not sent."
            : "Message was not sent. Keep it between 1 and 500 characters."
    };
  }
}
