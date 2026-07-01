"use server";

import { revalidatePath } from "next/cache";
import type { AdminStorageActionState } from "@/app/admin/storage/state";
import {
  assertBackupAcknowledgement,
  assertMaintenanceConfirmation,
  cleanOrphanUploadsConfirmationText
} from "@/lib/admin/maintenance-core";
import { cleanAdminOrphanUploads, formatStorageBytes } from "@/lib/admin/media-storage-service";
import { syncOffsiteBackupConfig, updateOffsiteBackupSettings } from "@/lib/admin/offsite-backup-settings";
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

export async function updateOffsiteBackupSettingsAction(
  _previousState: AdminStorageActionState,
  formData: FormData
): Promise<AdminStorageActionState> {
  try {
    const actor = await requireUserPermission("settings.manage");

    await updateOffsiteBackupSettings(
      {
        ageRecipient: formString(formData, "ageRecipient"),
        enabled: formData.get("enabled") === "on",
        outputDir: formString(formData, "outputDir"),
        rcloneRemote: formString(formData, "rcloneRemote"),
        removeLocalAfterUpload: formData.get("removeLocalAfterUpload") === "on"
      },
      actor.id
    );

    revalidatePath("/admin/storage");
    revalidatePath("/admin/system-health");
    revalidatePath("/admin/audit-logs");

    return {
      message: "External backup location saved for scheduled backups.",
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "External backup location could not be saved.",
      status: "error"
    };
  }
}

export async function syncOffsiteBackupConfigAction(
  _previousState: AdminStorageActionState,
  _formData: FormData
): Promise<AdminStorageActionState> {
  void _previousState;
  void _formData;

  try {
    const actor = await requireUserPermission("settings.manage");
    const result = await syncOffsiteBackupConfig(actor.id);

    revalidatePath("/admin/storage");
    revalidatePath("/admin/system-health");
    revalidatePath("/admin/audit-logs");

    return {
      message: `Generated backup config rewritten at ${result.configFile}.`,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Generated backup config could not be rewritten.",
      status: "error"
    };
  }
}
