"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  createChatRoom,
  ensureDefaultChatRooms,
  moderateChatMessage,
  updateChatRoom,
  type ChatRoomInput
} from "@/lib/chat/chat-service";
import { updateSheepThrowSettings } from "@/lib/chat/sheep-throw-service";
import { chatRoomTypeOptions, type ChatRoomType } from "@/lib/chat/chat-types";
import type { AdminChatroomsActionState } from "@/app/admin/chatrooms/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formStrings(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

function sheepSpriteInputs(formData: FormData) {
  const ids = formStrings(formData, "spriteId");
  const labels = formStrings(formData, "spriteLabel");
  const urls = formStrings(formData, "spriteSheetUrl");
  const enabled = formStrings(formData, "spriteEnabled");
  const frameCounts = formStrings(formData, "spriteFrameCount");
  const columns = formStrings(formData, "spriteColumns");
  const rows = formStrings(formData, "spriteRows");
  const frameWidths = formStrings(formData, "spriteFrameWidth");
  const frameHeights = formStrings(formData, "spriteFrameHeight");
  const rowCount = Math.max(ids.length, labels.length, urls.length);

  return Array.from({ length: rowCount }, (_, index) => ({
    columns: columns[index],
    enabled: enabled[index] !== "false",
    frameCount: frameCounts[index],
    frameHeight: frameHeights[index],
    frameWidth: frameWidths[index],
    id: ids[index],
    label: labels[index],
    rows: rows[index],
    spriteSheetUrl: urls[index]
  }));
}

function isChatRoomType(value: string): value is ChatRoomType {
  return chatRoomTypeOptions.includes(value as ChatRoomType);
}

function chatRoomInput(formData: FormData): ChatRoomInput {
  const type = formString(formData, "type");
  const slowModeSeconds = Number(formString(formData, "slowModeSeconds"));

  if (!isChatRoomType(type)) {
    throw new Error("Invalid chat room type.");
  }

  return {
    locked: formString(formData, "locked") === "true",
    roomId: formString(formData, "roomId") || undefined,
    name: formString(formData, "name"),
    slowModeSeconds: Number.isFinite(slowModeSeconds) ? slowModeSeconds : 0,
    slug: formString(formData, "slug"),
    type
  };
}

function revalidateChatViews() {
  revalidatePath("/admin/chatrooms");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/chat");
  revalidatePath("/live");
}

export async function adminChatroomsAction(
  _previousState: AdminChatroomsActionState,
  formData: FormData
): Promise<AdminChatroomsActionState> {
  const intent = formString(formData, "intent");
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "moderation.use")) {
    return {
      status: "error",
      message: "You do not have permission to manage chatrooms."
    };
  }

  try {
    if (intent === "ensure-default") {
      await ensureDefaultChatRooms(actor.id);
      revalidateChatViews();

      return {
        status: "success",
        message: "Default chat rooms are ready."
      };
    }

    if (intent === "create") {
      await createChatRoom(chatRoomInput(formData), actor.id);
      revalidateChatViews();

      return {
        status: "success",
        message: "Chat room created."
      };
    }

    if (intent === "update") {
      await updateChatRoom(chatRoomInput(formData), actor.id);
      revalidateChatViews();

      return {
        status: "success",
        message: "Chat room updated."
      };
    }

    if (intent === "sheep-settings") {
      await updateSheepThrowSettings(
        {
          enabled: formString(formData, "enabled") === "true",
          cooldownMinutes: formString(formData, "cooldownMinutes"),
          costStars: formString(formData, "costStars"),
          overlayDurationSeconds: formString(formData, "overlayDurationSeconds"),
          pollSeconds: formString(formData, "pollSeconds"),
          maxRecentEvents: formString(formData, "maxRecentEvents"),
          sprites: sheepSpriteInputs(formData)
        },
        actor.id
      );
      revalidateChatViews();

      return {
        status: "success",
        message: "Sheep throw settings updated."
      };
    }

    if (intent === "delete-message") {
      const messageId = formString(formData, "messageId");

      if (!messageId) {
        return {
          status: "error",
          message: "Missing chat message."
        };
      }

      await moderateChatMessage(messageId, actor.id);
      revalidateChatViews();

      return {
        status: "success",
        message: "Message hidden from public chat."
      };
    }

    return {
      status: "error",
      message: "Unknown chatroom action."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Chatroom action failed. Check slugs, room names, and moderation state."
    };
  }
}
