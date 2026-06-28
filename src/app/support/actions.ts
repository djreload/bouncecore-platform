"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { SupportActionState } from "@/app/support/state";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupportRequest } from "@/lib/support/support-service";

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

export async function supportRequestAction(_previousState: SupportActionState, formData: FormData): Promise<SupportActionState> {
  const [user, requestHeaders] = await Promise.all([getCurrentUser(), headers()]);

  try {
    const request = await createSupportRequest(
      {
        category: formString(formData, "category"),
        email: formString(formData, "email"),
        message: formString(formData, "message"),
        name: formString(formData, "name"),
        priority: formString(formData, "priority"),
        subject: formString(formData, "subject")
      },
      {
        ipAddress: clientIpFromHeaders(requestHeaders),
        source: "web",
        user,
        userAgent: requestHeaders.get("user-agent")
      }
    );

    revalidatePath("/admin/support");
    revalidatePath("/admin/audit-logs");

    return {
      message: "Support request sent. Keep the reference ID if you need to follow it up.",
      referenceId: request.id,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Support request could not be sent.",
      status: "error"
    };
  }
}
