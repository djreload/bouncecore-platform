"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { saveOptionalStreamOfflineImageUpload } from "@/lib/media/media-service";
import {
  createStreamChannel,
  ensureDefaultStreamChannel,
  updateStreamChannel
} from "@/lib/stream/stream-channel-service";
import { updateRestreamSettings } from "@/lib/stream/restream-settings-service";
import { updateStreamPlaybackSettings } from "@/lib/stream/stream-playback-settings-service";
import { ensureDefaultStreamProfiles, updateStreamProfile } from "@/lib/stream/stream-profile-service";
import { streamStatusOptions, type ChannelStatus } from "@/lib/stream/stream-status";
import type { AdminStreamActionState } from "@/app/admin/stream/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function isChannelStatus(value: string): value is ChannelStatus {
  return streamStatusOptions.includes(value as ChannelStatus);
}

async function streamChannelInput(formData: FormData) {
  const status = formString(formData, "status");
  const uploadedOfflineImageUrl = await saveOptionalStreamOfflineImageUpload(formFile(formData, "offlineImageFile"));

  if (!isChannelStatus(status)) {
    throw new Error("Invalid stream status.");
  }

  return {
    channelId: formString(formData, "channelId") || undefined,
    title: formString(formData, "title"),
    slug: formString(formData, "slug"),
    playbackUrl: formString(formData, "playbackUrl") || undefined,
    offlineImageUrl: (uploadedOfflineImageUrl ?? formString(formData, "offlineImageUrl")) || undefined,
    streamProfileId: formString(formData, "streamProfileId") || undefined,
    status
  };
}

function formNumber(formData: FormData, key: string) {
  const value = Number.parseInt(formString(formData, key), 10);

  return Number.isFinite(value) ? value : 0;
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function streamProfileInput(formData: FormData) {
  return {
    id: formString(formData, "profileId"),
    label: formString(formData, "label"),
    description: formString(formData, "description"),
    videoWidth: formNumber(formData, "videoWidth"),
    videoHeight: formNumber(formData, "videoHeight"),
    videoBitrateKbps: formNumber(formData, "videoBitrateKbps"),
    audioBitrateKbps: formNumber(formData, "audioBitrateKbps"),
    fps: formNumber(formData, "fps"),
    keyframeSeconds: formNumber(formData, "keyframeSeconds"),
    isEnabled: formBoolean(formData, "isEnabled"),
    isDefault: formBoolean(formData, "isDefault"),
    sortOrder: formNumber(formData, "sortOrder")
  };
}

function restreamSettingsInput(formData: FormData) {
  return {
    clearStreamKey: formBoolean(formData, "clearStreamKey"),
    enabled: formBoolean(formData, "enabled"),
    label: formString(formData, "label"),
    provider: formString(formData, "provider"),
    serverUrl: formString(formData, "serverUrl"),
    streamKey: formString(formData, "streamKey")
  };
}

function playbackSettingsInput(formData: FormData) {
  return {
    playbackBufferSeconds: formNumber(formData, "playbackBufferSeconds"),
    showUpcomingSets: formBoolean(formData, "showUpcomingSets")
  };
}

function revalidateStreamViews() {
  revalidatePath("/admin/stream");
  revalidatePath("/admin/stream-sessions");
  revalidatePath("/live");
  revalidatePath("/internal/stream/status");
  revalidatePath("/streamer/obs");
  revalidatePath("/streamer/status");
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

    if (intent === "ensure-profiles") {
      await ensureDefaultStreamProfiles(actor.id);
      revalidateStreamViews();

      return {
        status: "success",
        message: "Default stream profiles are ready."
      };
    }

    if (intent === "create") {
      const input = await streamChannelInput(formData);
      await createStreamChannel(input, actor.id);
      revalidateStreamViews();

      return {
        status: "success",
        message: "Stream channel created."
      };
    }

    if (intent === "update") {
      const input = await streamChannelInput(formData);
      await updateStreamChannel(input, actor.id);
      revalidateStreamViews();

      return {
        status: "success",
        message: "Stream channel updated."
      };
    }

    if (intent === "update-profile") {
      const input = streamProfileInput(formData);
      await updateStreamProfile(input, actor.id);
      revalidateStreamViews();

      return {
        status: "success",
        message: "Stream profile updated."
      };
    }

    if (intent === "update-restream") {
      await updateRestreamSettings(restreamSettingsInput(formData), actor.id);
      revalidateStreamViews();

      return {
        status: "success",
        message: "Restream output settings updated."
      };
    }

    if (intent === "update-playback-settings") {
      await updateStreamPlaybackSettings(playbackSettingsInput(formData), actor.id);
      revalidateStreamViews();

      return {
        status: "success",
        message: "Live player settings updated."
      };
    }

    return {
      status: "error",
      message: "Unknown stream channel action."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Stream channel action failed. Check the slug, status, and audit log."
    };
  }
}
