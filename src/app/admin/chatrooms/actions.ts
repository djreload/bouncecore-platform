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
import { chatRoomTypeOptions, type ChatRoomType } from "@/lib/chat/chat-types";
import type { AdminChatroomsActionState } from "@/app/admin/chatrooms/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isChatRoomType(value: string): value is ChatRoomType {
  return chatRoomTypeOptions.includes(value as ChatRoomType);
}

function chatRoomInput(formData: FormData): ChatRoomInput {
  const type = formString(formData, "type");

  if (!isChatRoomType(type)) {
    throw new Error("Invalid chat room type.");
  }

  return {
    roomId: formString(formData, "roomId") || undefined,
    name: formString(formData, "name"),
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
  } catch {
    return {
      status: "error",
      message: "Chatroom action failed. Check slugs, room names, and moderation state."
    };
  }
}
