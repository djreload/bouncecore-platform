"use server";

import { revalidatePath } from "next/cache";
import { createChatMessage } from "@/lib/chat/chat-service";
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
    await createChatMessage(roomId, body, user.id);
    revalidatePath("/chat");
    revalidatePath("/live");

    return {
      status: "success",
      message: "Message sent."
    };
  } catch {
    return {
      status: "error",
      message: "Message was not sent. Keep it between 1 and 500 characters."
    };
  }
}
