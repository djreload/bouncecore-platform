"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PublicAccountDeletionActionState } from "@/app/account/delete/state";
import { createPublicAccountDeletionRequest } from "@/lib/account/public-account-deletion-service";
import { getCurrentUser } from "@/lib/auth/session";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function clientIpFromHeaders(requestHeaders: Headers) {
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("cf-connecting-ip") ||
    null
  );
}

export async function publicAccountDeletionRequestAction(
  _previousState: PublicAccountDeletionActionState,
  formData: FormData
): Promise<PublicAccountDeletionActionState> {
  const [user, requestHeaders] = await Promise.all([getCurrentUser(), headers()]);

  try {
    const request = await createPublicAccountDeletionRequest(
      {
        confirmation: formString(formData, "confirmation"),
        email: formString(formData, "email"),
        name: formString(formData, "name"),
        reason: formString(formData, "reason")
      },
      {
        ipAddress: clientIpFromHeaders(requestHeaders),
        user,
        userAgent: requestHeaders.get("user-agent")
      }
    );

    revalidatePath("/account/delete");
    revalidatePath("/admin/support");
    revalidatePath("/admin/audit-logs");

    return {
      message: "Account deletion request sent. Keep the reference ID while the operator verifies ownership and retention requirements.",
      referenceId: request.id,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Account deletion request could not be sent.",
      status: "error"
    };
  }
}
