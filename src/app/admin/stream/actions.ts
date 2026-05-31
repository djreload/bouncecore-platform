"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  createStreamChannel,
  ensureDefaultStreamChannel,
  updateStreamChannel
} from "@/lib/stream/stream-channel-service";
import { streamStatusOptions, type ChannelStatus } from "@/lib/stream/stream-status";
import type { AdminStreamActionState } from "@/app/admin/stream/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isChannelStatus(value: string): value is ChannelStatus {
  return streamStatusOptions.includes(value as ChannelStatus);
}

function streamChannelInput(formData: FormData) {
  const status = formString(formData, "status");

  if (!isChannelStatus(status)) {
    throw new Error("Invalid stream status.");
  }

  return {
    channelId: formString(formData, "channelId") || undefined,
    title: formString(formData, "title"),
    slug: formString(formData, "slug"),
    playbackUrl: formString(formData, "playbackUrl") || undefined,
    status
  };
}

function revalidateStreamViews() {
  revalidatePath("/admin/stream");
  revalidatePath("/admin/stream-sessions");
  revalidatePath("/live");
  revalidatePath("/internal/stream/status");
}

export async function adminStreamAction(
  _previousState: AdminStreamActionState,
  formData: FormData
): Promise<AdminStreamActionState> {
  const intent = formString(formData, "intent");
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "stream.settings.manage")) {
    return {
      status: "error",
      message: "You do not have permission to manage stream settings."
    };
  }

  try {
    if (intent === "ensure-default") {
      await ensureDefaultStreamChannel(actor.id);
      revalidateStreamViews();

      return {
        status: "success",
        message: "Default Bouncecore Live channel is ready."
      };
    }

    if (intent === "create") {
      const input = streamChannelInput(formData);
      await createStreamChannel(input, actor.id);
      revalidateStreamViews();

      return {
        status: "success",
        message: "Stream channel created."
      };
    }

    if (intent === "update") {
      const input = streamChannelInput(formData);
      await updateStreamChannel(input, actor.id);
      revalidateStreamViews();

      return {
        status: "success",
        message: "Stream channel updated."
      };
    }

    return {
      status: "error",
      message: "Unknown stream channel action."
    };
  } catch {
    return {
      status: "error",
      message: "Stream channel action failed. Check the slug, status, and audit log."
    };
  }
}
