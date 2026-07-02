"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PrivacyRightsActionState } from "@/app/privacy/requests/state";
import { getCurrentUser } from "@/lib/auth/session";
import { createPrivacyRightsRequest } from "@/lib/privacy/privacy-rights-service";

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

export async function privacyRightsRequestAction(
  _previousState: PrivacyRightsActionState,
  formData: FormData
): Promise<PrivacyRightsActionState> {
  const [user, requestHeaders] = await Promise.all([getCurrentUser(), headers()]);

  try {
    const request = await createPrivacyRightsRequest(
      {
        email: formString(formData, "email"),
        message: formString(formData, "message"),
        name: formString(formData, "name"),
        requestType: formString(formData, "requestType")
      },
      {
        ipAddress: clientIpFromHeaders(requestHeaders),
        user,
        userAgent: requestHeaders.get("user-agent")
      }
    );

    revalidatePath("/privacy/requests");
    revalidatePath("/admin/support");
    revalidatePath("/admin/audit-logs");

    return {
      message: "Privacy request sent. Keep the reference ID while the operator verifies the request.",
      referenceId: request.id,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Privacy request could not be sent.",
      status: "error"
    };
  }
}
