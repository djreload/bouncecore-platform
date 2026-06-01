"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  setAdminTrackStatus,
  updateAdminTrack,
  type AdminTrackInput
} from "@/lib/music/admin-music-service";
import { digitalTrackStatusOptions, type DigitalTrackStatus } from "@/lib/music/music-service";
import type { AdminTracksActionState } from "@/app/admin/tracks/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isTrackStatus(value: string): value is DigitalTrackStatus {
  return digitalTrackStatusOptions.includes(value as DigitalTrackStatus);
}

function trackInput(formData: FormData): AdminTrackInput {
  const status = formString(formData, "status");

  if (!isTrackStatus(status)) {
    throw new Error("Invalid track status.");
  }

  return {
    bpm: formString(formData, "bpm"),
    genre: formString(formData, "genre"),
    musicalKey: formString(formData, "musicalKey"),
    pricePounds: formString(formData, "pricePounds"),
    slug: formString(formData, "slug"),
    status,
    title: formString(formData, "title"),
    trackId: formString(formData, "trackId")
  };
}

function revalidateMusicViews() {
  revalidatePath("/admin/tracks");
  revalidatePath("/admin/producer-approvals");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/music");
  revalidatePath("/producers");
  revalidatePath("/producer");
  revalidatePath("/producer/reviews");
  revalidatePath("/producer/sales");
}

export async function adminTracksAction(
  _previousState: AdminTracksActionState,
  formData: FormData
): Promise<AdminTracksActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "music.manage")) {
    return {
      status: "error",
      message: "You do not have permission to manage music tracks."
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "update-track") {
      const track = await updateAdminTrack(actor.id, trackInput(formData));
      revalidateMusicViews();

      return {
        status: "success",
        message: `Track ${track.title} updated.`
      };
    }

    if (intent === "set-status") {
      const status = formString(formData, "status");

      if (!isTrackStatus(status)) {
        return {
          status: "error",
          message: "Invalid track status."
        };
      }

      const track = await setAdminTrackStatus(actor.id, formString(formData, "trackId"), status);
      revalidateMusicViews();

      return {
        status: "success",
        message: `Track ${track.title} moved to ${track.status}.`
      };
    }

    return {
      status: "error",
      message: "Unknown track action."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Track action failed."
    };
  }
}
