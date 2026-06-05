"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { createChatBan, revokeChatBan, type ChatBanInput } from "@/lib/chat/moderation-service";
import type { AdminBansActionState } from "@/app/admin/bans/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function banInput(formData: FormData): ChatBanInput {
  return {
    duration: formString(formData, "duration"),
    notes: formString(formData, "notes"),
    reason: formString(formData, "reason"),
    roomId: formString(formData, "roomId"),
    userId: formString(formData, "userId")
  };
}

function revalidateBanViews() {
  revalidatePath("/admin/bans");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/account/notifications");
  revalidatePath("/chat");
  revalidatePath("/live");
}

export async function adminBansAction(
  _previousState: AdminBansActionState,
  formData: FormData
): Promise<AdminBansActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "moderation.use")) {
    return {
      message: "You do not have permission to manage chat bans.",
      status: "error"
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "create") {
      await createChatBan(banInput(formData), actor.id);
      revalidateBanViews();

      return {
        message: "Chat ban created.",
        status: "success"
      };
    }

    if (intent === "revoke") {
      await revokeChatBan(formString(formData, "banId"), actor.id);
      revalidateBanViews();

      return {
        message: "Chat ban revoked.",
        status: "success"
      };
    }

    return {
      message: "Unknown ban action.",
      status: "error"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Chat ban action failed.",
      status: "error"
    };
  }
}
