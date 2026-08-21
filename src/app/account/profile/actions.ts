"use server";

import { revalidatePath } from "next/cache";
import { requireSignedInUser } from "@/lib/auth/guards";
import { updateAccountProfile, type AccountProfileInput } from "@/lib/account/account-service";
import type { AccountProfileActionState } from "@/app/account/profile/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function profileInput(formData: FormData): AccountProfileInput {
  return {
    avatarUrl: formString(formData, "avatarUrl"),
    bio: formString(formData, "bio"),
    displayName: formString(formData, "displayName"),
    isPublic: formData.get("isPublic") === "on",
    location: formString(formData, "location"),
    slug: formString(formData, "slug"),
    websiteUrl: formString(formData, "websiteUrl")
  };
}

export async function updateAccountProfileAction(
  _previousState: AccountProfileActionState,
  formData: FormData
): Promise<AccountProfileActionState> {
  const actor = await requireSignedInUser();

  try {
    const profile = await updateAccountProfile(actor.id, profileInput(formData));

    revalidatePath("/account");
    revalidatePath("/account/profile");
    revalidatePath("/account/settings");
    revalidatePath("/streamer/profile");
    revalidatePath("/djs");
    revalidatePath(`/djs/${profile.slug}`);

    return {
      status: "success",
      message: "Account profile saved.",
      profileUrl: profile.isPublic ? `/djs/${profile.slug}` : undefined
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Profile update failed."
    };
  }
}
