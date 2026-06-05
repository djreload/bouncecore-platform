"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  createManualPrizeClaim,
  updatePrizeClaimStatus,
  type PrizeClaimInput,
  type PrizeClaimStatusInput
} from "@/lib/rewards/prize-service";
import type { AdminPrizeClaimsActionState } from "@/app/admin/prize-claims/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function claimInput(formData: FormData): PrizeClaimInput {
  return {
    description: formString(formData, "description"),
    prizeType: formString(formData, "prizeType"),
    prizeValue: formString(formData, "prizeValue"),
    segmentId: formString(formData, "segmentId"),
    starAmount: formString(formData, "starAmount"),
    title: formString(formData, "title"),
    userId: formString(formData, "userId"),
    wheelId: formString(formData, "wheelId")
  };
}

function statusInput(formData: FormData): PrizeClaimStatusInput {
  return {
    claimId: formString(formData, "claimId"),
    fulfilmentNote: formString(formData, "fulfilmentNote"),
    status: formString(formData, "status")
  };
}

function revalidatePrizeViews() {
  revalidatePath("/admin/prize-claims");
  revalidatePath("/admin/spin-wheels");
  revalidatePath("/admin/stars");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/account/rewards");
  revalidatePath("/account/notifications");
  revalidatePath("/rewards");
}

export async function adminPrizeClaimsAction(
  _previousState: AdminPrizeClaimsActionState,
  formData: FormData
): Promise<AdminPrizeClaimsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "rewards.manage")) {
    return {
      message: "You do not have permission to manage prize claims.",
      status: "error"
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "create") {
      await createManualPrizeClaim(claimInput(formData), actor.id);
      revalidatePrizeViews();

      return {
        message: "Prize claim created.",
        status: "success"
      };
    }

    if (intent === "status") {
      await updatePrizeClaimStatus(statusInput(formData), actor.id);
      revalidatePrizeViews();

      return {
        message: "Prize claim status saved.",
        status: "success"
      };
    }

    return {
      message: "Unknown prize claim action.",
      status: "error"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Prize claim action failed.",
      status: "error"
    };
  }
}
