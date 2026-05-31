"use server";

import { revalidatePath } from "next/cache";
import { createChatGifMessage, createChatMessage } from "@/lib/chat/chat-service";
import { getCurrentUser } from "@/lib/auth/session";
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
    if (intent === "gif") {
      await createChatGifMessage(roomId, user.id, {
        id: formString(formData, "gifId"),
        url: formString(formData, "gifUrl"),
        previewUrl: formString(formData, "gifPreviewUrl"),
        alt: formString(formData, "gifAlt"),
        searchTerm: formString(formData, "gifQuery"),
        width: Number(formString(formData, "gifWidth")) || null,
        height: Number(formString(formData, "gifHeight")) || null
      });
    } else {
      await createChatMessage(roomId, body, user.id);
    }

    revalidatePath("/chat");
    revalidatePath("/live");

    return {
      status: "success",
      message: intent === "gif" ? "GIF sent." : "Message sent."
    };
  } catch {
    return {
      status: "error",
      message: intent === "gif" ? "GIF was not sent. Try another result." : "Message was not sent. Keep it between 1 and 500 characters."
    };
  }
}
