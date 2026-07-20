"use server";

import { revalidatePath } from "next/cache";
import type { AdminRaveWarRepairActionState } from "@/app/admin/rave-wars/state";
import { requireUserPermission } from "@/lib/auth/guards";
import {
  assertRaveWarAdminRepairConfirmation,
  normalizeRaveWarAdminRepairReason,
  type RaveWarAdminRepairAction
} from "@/lib/rave-wars/rave-war-admin-repair-core";
import { forceEndAdminRaveWar, resyncAdminRaveWar } from "@/lib/rave-wars/rave-war-admin-service";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function revalidateRaveWarRepairViews(warId: string) {
  revalidatePath("/admin/rave-wars");
  revalidatePath(`/admin/rave-wars/${warId}`);
  revalidatePath("/admin/audit-logs");
  revalidatePath("/chat");
  revalidatePath("/live");
  revalidatePath(`/rave-wars/${warId}`);
}

export async function adminRaveWarRepairAction(
  _previousState: AdminRaveWarRepairActionState,
  formData: FormData
): Promise<AdminRaveWarRepairActionState> {
  try {
    const actor = await requireUserPermission("settings.manage");
    const intent = formString(formData, "intent") as RaveWarAdminRepairAction;
    const warId = formString(formData, "warId").trim();

    if (intent !== "resync" && intent !== "force-end") {
      throw new Error("Choose a valid Rave War repair action.");
    }

    if (!warId) {
      throw new Error("Rave War match id is missing.");
    }

    assertRaveWarAdminRepairConfirmation(intent, warId, formString(formData, "confirmation"));
    const reason = normalizeRaveWarAdminRepairReason(formString(formData, "reason"));

    if (intent === "resync") {
      const result = await resyncAdminRaveWar(warId, actor.id, reason);
      revalidateRaveWarRepairViews(warId);

      return {
        message: `Match resynced at revision ${result.revision}. Connected players were notified.`,
        status: "success"
      };
    }

    const result = await forceEndAdminRaveWar(warId, actor.id, reason);
    revalidateRaveWarRepairViews(warId);

    return {
      message: `Match force-ended with status ${result.status}. Connected players were notified.`,
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Rave War repair failed.",
      status: "error"
    };
  }
}
