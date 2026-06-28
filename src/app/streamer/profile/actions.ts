"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { updateStreamerProfile, type StreamerProfileInput } from "@/lib/profile/dj-profile-service";
import { saveOptionalProfileAvatarUpload } from "@/lib/media/media-service";
import type { StreamerProfileActionState } from "@/app/streamer/profile/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

async function profileInput(formData: FormData): Promise<StreamerProfileInput> {
  const uploadedAvatarUrl = await saveOptionalProfileAvatarUpload(formFile(formData, "avatarFile"));

  return {
    avatarUrl: uploadedAvatarUrl ?? formString(formData, "avatarUrl"),
    bio: formString(formData, "bio"),
    isPublic: formData.get("isPublic") === "on",
    location: formString(formData, "location"),
    slug: formString(formData, "slug"),
    websiteUrl: formString(formData, "websiteUrl")
  };
}

export async function updateStreamerProfileAction(
  _previousState: StreamerProfileActionState,
  formData: FormData
): Promise<StreamerProfileActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "stream.dashboard")) {
    return {
      status: "error",
      message: "You do not have permission to update a streamer profile."
    };
  }

  try {
    const profile = await updateStreamerProfile(actor.id, await profileInput(formData));

    revalidatePath("/streamer/profile");
    revalidatePath("/djs");
    revalidatePath(`/djs/${profile.slug}`);

    return {
      status: "success",
      message: "Public DJ profile saved.",
      profileUrl: profile.isPublic ? `/djs/${profile.slug}` : undefined
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Profile update failed."
    };
  }
}
