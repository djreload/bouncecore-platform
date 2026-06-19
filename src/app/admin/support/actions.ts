"use server";

import { revalidatePath } from "next/cache";
import type { AdminSupportActionState } from "@/app/admin/support/state";
import { requireUserPermission } from "@/lib/auth/guards";
import { updateSupportRequestStatus } from "@/lib/support/support-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function adminSupportAction(
  _previousState: AdminSupportActionState,
  formData: FormData
): Promise<AdminSupportActionState> {
  const actor = await requireUserPermission("admin.access");

  try {
    await updateSupportRequestStatus({
      actor,
      requestId: formString(formData, "requestId"),
      resolutionNote: formString(formData, "resolutionNote"),
      status: formString(formData, "status")
    });
    revalidatePath("/admin/support");
    revalidatePath("/admin/audit-logs");

    return {
      message: "Support request updated.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Support request could not be updated.",
      status: "error"
    };
  }
}
