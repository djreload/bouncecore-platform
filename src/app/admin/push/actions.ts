"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { sendAdminNotification, type AdminPushInput } from "@/lib/admin/push-service";
import { checkExpoMobilePushReceipts, processQueuedMobilePushDeliveries } from "@/lib/mobile/push-dispatch-service";
import type { AdminPushActionState } from "@/app/admin/push/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function pushInput(formData: FormData): AdminPushInput {
  return {
    body: formString(formData, "body"),
    role: formString(formData, "role"),
    target: formString(formData, "target"),
    title: formString(formData, "title"),
    type: formString(formData, "type"),
    userId: formString(formData, "userId")
  };
}

function revalidatePushViews() {
  revalidatePath("/admin/push");
  revalidatePath("/admin/notification-logs");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/account");
  revalidatePath("/account/notifications");
}

export async function adminPushAction(
  _previousState: AdminPushActionState,
  formData: FormData
): Promise<AdminPushActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "mobile.manage")) {
    return {
      message: "You do not have permission to send platform notifications.",
      status: "error"
    };
  }

  try {
    const result = await sendAdminNotification(actor.id, pushInput(formData));
    revalidatePushViews();

    return {
      message: `Notification sent to ${result.recipientCount} active user${result.recipientCount === 1 ? "" : "s"}; ${result.queuedPushDeliveryCount} mobile push${result.queuedPushDeliveryCount === 1 ? "" : "es"} queued, ${result.blockedPushDeliveryCount} blocked.`,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Notification could not be sent.",
      status: "error"
    };
  }
}

export async function adminProcessPushQueueAction(
  _previousState: AdminPushActionState,
  _formData: FormData
): Promise<AdminPushActionState> {
  void _previousState;
  void _formData;

  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "mobile.manage")) {
    return {
      message: "You do not have permission to process mobile push deliveries.",
      status: "error"
    };
  }

  try {
    const result = await processQueuedMobilePushDeliveries(actor.id);
    revalidatePushViews();

    return {
      message: `Processed ${result.processedCount} queued mobile push${result.processedCount === 1 ? "" : "es"}; ${result.sentCount} sent, ${result.failedCount} failed, ${result.blockedCount} blocked.`,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Mobile push queue could not be processed.",
      status: "error"
    };
  }
}

export async function adminCheckPushReceiptsAction(
  _previousState: AdminPushActionState,
  _formData: FormData
): Promise<AdminPushActionState> {
  void _previousState;
  void _formData;

  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "mobile.manage")) {
    return {
      message: "You do not have permission to check mobile push receipts.",
      status: "error"
    };
  }

  try {
    const result = await checkExpoMobilePushReceipts(actor.id);
    revalidatePushViews();

    return {
      message: `Checked ${result.processedCount} Expo receipt${result.processedCount === 1 ? "" : "s"}; ${result.deliveredCount} delivered, ${result.failedCount} failed, ${result.pendingCount} pending.`,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Mobile push receipts could not be checked.",
      status: "error"
    };
  }
}
