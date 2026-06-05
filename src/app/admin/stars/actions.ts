"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  adjustStarBalance,
  ensureStarWallet,
  parseStarAdjustment,
  parseStarBalance,
  setStarBalance
} from "@/lib/rewards/stars-service";
import { updateStarAlertSettings } from "@/lib/stars/star-alert-settings-service";
import type { AdminStarsActionState } from "@/app/admin/stars/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function revalidateStarsViews() {
  revalidatePath("/admin/stars");
  revalidatePath("/admin/supporters");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/rewards");
  revalidatePath("/account/rewards");
}

export async function adminStarsAction(
  _previousState: AdminStarsActionState,
  formData: FormData
): Promise<AdminStarsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "payments.manage")) {
    return {
      status: "error",
      message: "You do not have permission to manage star wallets."
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "alert-settings") {
      await updateStarAlertSettings(
        {
          enabled: formBoolean(formData, "enabled"),
          scope: formString(formData, "scope"),
          effectMode: formString(formData, "effectMode"),
          durationSeconds: formString(formData, "durationSeconds"),
          confettiMinimumStars: formString(formData, "confettiMinimumStars"),
          fireworksMinimumStars: formString(formData, "fireworksMinimumStars")
        },
        actor.id
      );
      revalidateStarsViews();
      revalidatePath("/live");
      revalidatePath("/chat");

      return {
        status: "success",
        message: "Star alert settings saved."
      };
    }

    const userId = formString(formData, "userId");

    if (!userId) {
      return {
        status: "error",
        message: "Choose a user first."
      };
    }

    if (intent === "ensure-wallet") {
      await ensureStarWallet(userId, actor.id);
      revalidateStarsViews();

      return {
        status: "success",
        message: "Stars wallet is ready."
      };
    }

    if (intent === "set-balance") {
      await setStarBalance(userId, actor.id, parseStarBalance(formString(formData, "balance")));
      revalidateStarsViews();

      return {
        status: "success",
        message: "Stars balance saved."
      };
    }

    if (intent === "adjust-balance") {
      await adjustStarBalance(userId, actor.id, parseStarAdjustment(formString(formData, "delta")));
      revalidateStarsViews();

      return {
        status: "success",
        message: "Stars balance adjusted."
      };
    }

    return {
      status: "error",
      message: "Unknown stars action."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Stars action failed."
    };
  }
}
