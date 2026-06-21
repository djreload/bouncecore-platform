"use server";

import { revalidatePath } from "next/cache";
import { requireUserPermission } from "@/lib/auth/guards";
import { assertMaintenanceConfirmation, clearAuditLogsConfirmationText } from "@/lib/admin/maintenance-core";
import { prisma } from "@/lib/db/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function clearAuditLogsAction(formData: FormData) {
  const actor = await requireUserPermission("settings.manage");

  assertMaintenanceConfirmation(formString(formData, "confirmation"), clearAuditLogsConfirmationText);

  const result = await prisma.auditLog.deleteMany();

  await prisma.auditLog.create({
    data: {
      action: "audit.logs.clear",
      actorId: actor.id,
      metadata: {
        deletedAuditLogs: result.count
      },
      severity: "critical",
      target: "audit-logs"
    }
  });

  revalidatePath("/admin/audit-logs");
  revalidatePath("/admin");
}
