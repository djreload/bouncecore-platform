"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  cancelStreamSchedule,
  createStreamSchedule,
  streamScheduleStatusOptions,
  updateStreamSchedule,
  type StreamScheduleInput,
  type StreamScheduleStatus
} from "@/lib/stream/stream-schedule-service";
import type { AdminScheduleActionState } from "@/app/admin/schedules/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isScheduleStatus(value: string): value is StreamScheduleStatus {
  return streamScheduleStatusOptions.includes(value as StreamScheduleStatus);
}

function scheduleInput(formData: FormData): StreamScheduleInput {
  const status = formString(formData, "status");

  if (!isScheduleStatus(status)) {
    throw new Error("Invalid schedule status.");
  }

  return {
    scheduleId: formString(formData, "scheduleId") || undefined,
    channelId: formString(formData, "channelId"),
    hostUserId: formString(formData, "hostUserId") || undefined,
    title: formString(formData, "title"),
    description: formString(formData, "description") || undefined,
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
    status,
    timezoneOffsetMinutes: Number(formString(formData, "timezoneOffsetMinutes"))
  };
}

function revalidateScheduleViews() {
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/stream");
  revalidatePath("/admin/stream-sessions");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/live");
  revalidatePath("/streamer/schedule");
}

export async function adminScheduleAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const intent = formString(formData, "intent");
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "stream.settings.manage")) {
    return {
      status: "error",
      message: "You do not have permission to manage stream schedules."
    };
  }

  try {
    if (intent === "create") {
      await createStreamSchedule(scheduleInput(formData), actor.id);
      revalidateScheduleViews();

      return {
        status: "success",
        message: "Schedule created."
      };
    }

    if (intent === "update") {
      await updateStreamSchedule(scheduleInput(formData), actor.id);
      revalidateScheduleViews();

      return {
        status: "success",
        message: "Schedule updated."
      };
    }

    if (intent === "cancel") {
      await cancelStreamSchedule(formString(formData, "scheduleId"), actor.id);
      revalidateScheduleViews();

      return {
        status: "success",
        message: "Schedule cancelled."
      };
    }

    return {
      status: "error",
      message: "Unknown schedule action."
    };
  } catch {
    return {
      status: "error",
      message: "Schedule action failed. Check channel, dates, and status."
    };
  }
}
