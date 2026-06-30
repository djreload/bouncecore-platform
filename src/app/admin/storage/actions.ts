"use server";

import { revalidatePath } from "next/cache";
import type { AdminStorageActionState } from "@/app/admin/storage/state";
import {
  assertBackupAcknowledgement,
  assertMaintenanceConfirmation,
  cleanOrphanUploadsConfirmationText
} from "@/lib/admin/maintenance-core";
import { cleanAdminOrphanUploads, formatStorageBytes } from "@/lib/admin/media-storage-service";
import { requireUserPermission } from "@/lib/auth/guards";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function cleanOrphanUploadsAction(
  _previousState: AdminStorageActionState,
  formData: FormData
): Promise<AdminStorageActionState> {
  try {
    const actor = await requireUserPermission("settings.manage");

    assertMaintenanceConfirmation(formString(formData, "confirmation"), cleanOrphanUploadsConfirmationText);
    assertBackupAcknowledgement(formData.get("backupAcknowledged"));

    const result = await cleanAdminOrphanUploads(actor);

    revalidatePath("/admin/storage");
    revalidatePath("/admin/audit-logs");
    revalidatePath("/admin/system-health");

    const deletedText = `${result.deletedFiles.toLocaleString("en-GB")} orphan upload files cleaned`;
    const sizeText = formatStorageBytes(result.deletedSizeBytes);
    const skippedText = result.skippedFiles ? ` ${result.skippedFiles.toLocaleString("en-GB")} skipped after re-check.` : "";
    const failedText = result.failedFiles ? ` ${result.failedFiles.toLocaleString("en-GB")} failed.` : "";

    return {
      message: `${deletedText}, freeing ${sizeText}.${skippedText}${failedText}`,
      status: result.failedFiles ? "error" : "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Orphan uploads could not be cleaned.",
      status: "error"
    };
  }
}
