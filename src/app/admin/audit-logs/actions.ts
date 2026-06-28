"use server";

import { revalidatePath } from "next/cache";
import type { AdminAuditLogsActionState } from "@/app/admin/audit-logs/state";
import { requireUserPermission } from "@/lib/auth/guards";
import { assertMaintenanceConfirmation, clearAuditLogsConfirmationText } from "@/lib/admin/maintenance-core";
import { prisma } from "@/lib/db/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function clearAuditLogsAction(
  _previousState: AdminAuditLogsActionState,
  formData: FormData
): Promise<AdminAuditLogsActionState> {
  try {
    const actor = await requireUserPermission("settings.manage");

    assertMaintenanceConfirmation(formString(formData, "confirmation"), clearAuditLogsConfirmationText);

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.auditLog.deleteMany();

      await tx.auditLog.create({
        data: {
          action: "audit.logs.clear",
          actorId: actor.id,
          metadata: {
            deletedAuditLogs: deleted.count
          },
          severity: "critical",
          target: "audit-logs"
        }
      });

      return deleted;
    });

    revalidatePath("/admin/audit-logs");
    revalidatePath("/admin");

    return {
      message: `${result.count.toLocaleString("en-GB")} audit log records cleared.`,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Audit logs could not be cleared.",
      status: "error"
    };
  }
}
