"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  hideReportedMessage,
  updateChatReportStatus,
  type ChatReportStatusInput
} from "@/lib/chat/moderation-service";
import type { AdminReportsActionState } from "@/app/admin/reports/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function statusInput(formData: FormData): ChatReportStatusInput {
  return {
    reportId: formString(formData, "reportId"),
    resolutionNote: formString(formData, "resolutionNote"),
    status: formString(formData, "status")
  };
}

function revalidateReportViews() {
  revalidatePath("/admin/reports");
  revalidatePath("/admin/chatrooms");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/chat");
  revalidatePath("/live");
}

export async function adminReportsAction(
  _previousState: AdminReportsActionState,
  formData: FormData
): Promise<AdminReportsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "moderation.use")) {
    return {
      message: "You do not have permission to manage moderation reports.",
      status: "error"
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "status") {
      await updateChatReportStatus(statusInput(formData), actor.id);
      revalidateReportViews();

      return {
        message: "Report status saved.",
        status: "success"
      };
    }

    if (intent === "hide-message") {
      await hideReportedMessage(formString(formData, "reportId"), actor.id);
      revalidateReportViews();

      return {
        message: "Reported message hidden and report resolved.",
        status: "success"
      };
    }

    return {
      message: "Unknown report action.",
      status: "error"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Report action failed.",
      status: "error"
    };
  }
}
