"use server";

import { revalidatePath } from "next/cache";
import {
  createChatGifMessage,
  createChatMessage,
  createChatStickerMessage,
  moderateChatMessage,
  toggleChatMessageReaction
} from "@/lib/chat/chat-service";
import { hasPermission } from "@/lib/auth/rbac";
import { createChatBan, createChatReport } from "@/lib/chat/moderation-service";
import { getCurrentUser } from "@/lib/auth/session";
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
      status: "error",
      message: "Sign in to send chat messages."
    };
  }

  if (!roomId) {
    return {
      status: "error",
      message: "Choose a chat room before sending a message."
    };
  }

  try {
    if (intent === "report") {
      await createChatReport(
        {
          messageId: formString(formData, "messageId"),
          notes: formString(formData, "reportNotes"),
          reason: formString(formData, "reason")
        },
        user.id
      );
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
    } else if (intent === "stars") {
      await createLiveChatStarSend(roomId, user.id, {
        amount: formString(formData, "amount"),
        note: formString(formData, "note")
      });
    } else {
      await createChatMessage(roomId, body, user.id, formString(formData, "effectId"));
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
      status: "success",
      message:
        intent === "report"
          ? "Report sent to moderators."
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
            : intent === "stars"
              ? "Stars sent to live chat."
              : "Message sent."
    };
  } catch (error) {
    if (intent === "report" || intent === "delete-message" || intent === "ban-user") {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : intent === "delete-message"
              ? "Message was not removed."
              : intent === "ban-user"
                ? "Chat ban was not created."
                : "Report was not sent."
      };
    }

    return {
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
            : intent === "stars"
              ? "Stars were not sent."
            : "Message was not sent. Keep it between 1 and 500 characters."
    };
  }
}
