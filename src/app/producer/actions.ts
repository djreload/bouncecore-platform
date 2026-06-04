"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  archiveProducerTrack,
  createProducerTrack,
  digitalTrackStatusOptions,
  updateProducerProfile,
  updateProducerTrack,
  type DigitalTrackInput,
  type DigitalTrackStatus,
  type ProducerProfileInput
} from "@/lib/music/music-service";
import type { ProducerActionState } from "@/app/producer/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isTrackStatus(value: string): value is DigitalTrackStatus {
  return digitalTrackStatusOptions.includes(value as DigitalTrackStatus);
}

function profileInput(formData: FormData): ProducerProfileInput {
  return {
    bio: formString(formData, "bio"),
    name: formString(formData, "name"),
    paypalPayoutEmail: formString(formData, "paypalPayoutEmail"),
    slug: formString(formData, "slug")
  };
}

function trackInput(formData: FormData): DigitalTrackInput {
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
    trackId: formString(formData, "trackId") || undefined
  };
}

function revalidateProducerViews(slug?: string) {
  revalidatePath("/producer");
  revalidatePath("/producer/profile");
  revalidatePath("/producer/sales");
  revalidatePath("/producer/tracks");
  revalidatePath("/producer/upload");
  revalidatePath("/music");
  revalidatePath("/producers");

  if (slug) {
    revalidatePath(`/producers/${slug}`);
  }
}

export async function producerAction(
  _previousState: ProducerActionState,
  formData: FormData
): Promise<ProducerActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "producer.dashboard")) {
    return {
      status: "error",
      message: "You do not have permission to manage producer content."
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "profile") {
      const profile = await updateProducerProfile(actor.id, profileInput(formData));
      revalidateProducerViews(profile.slug);

      return {
        status: "success",
        message: "Producer profile saved."
      };
    }

    if (intent === "create-track") {
      const track = await createProducerTrack(actor.id, trackInput(formData));
      revalidateProducerViews();

      return {
        status: "success",
        message: `Track ${track.title} created.`
      };
    }

    if (intent === "update-track") {
      const track = await updateProducerTrack(actor.id, trackInput(formData));
      revalidateProducerViews();

      return {
        status: "success",
        message: `Track ${track.title} updated.`
      };
    }

    if (intent === "archive-track") {
      await archiveProducerTrack(actor.id, formString(formData, "trackId"));
      revalidateProducerViews();

      return {
        status: "success",
        message: "Track archived."
      };
    }

    return {
      status: "error",
      message: "Unknown producer action."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Producer action failed."
    };
  }
}
