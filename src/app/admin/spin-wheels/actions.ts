"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import {
  createOrUpdateRewardSegment,
  createOrUpdateRewardWheel,
  ensureDefaultRewardWheel,
  moveRewardSegment,
  type RewardSegmentInput,
  type RewardWheelInput
} from "@/lib/rewards/prize-service";
import type { AdminSpinWheelsActionState } from "@/app/admin/spin-wheels/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function wheelInput(formData: FormData): RewardWheelInput {
  return {
    cooldownMinutes: formString(formData, "cooldownMinutes"),
    costStars: formString(formData, "costStars"),
    description: formString(formData, "description"),
    name: formString(formData, "name"),
    slug: formString(formData, "slug"),
    status: formString(formData, "status"),
    wheelId: formString(formData, "wheelId")
  };
}

function segmentInput(formData: FormData): RewardSegmentInput {
  return {
    label: formString(formData, "label"),
    prizeType: formString(formData, "prizeType"),
    prizeValue: formString(formData, "prizeValue"),
    segmentId: formString(formData, "segmentId"),
    sortOrder: formString(formData, "sortOrder"),
    starAmount: formString(formData, "starAmount"),
    status: formString(formData, "status"),
    weight: formString(formData, "weight"),
    wheelId: formString(formData, "wheelId")
  };
}

function revalidateRewardsViews() {
  revalidatePath("/admin/spin-wheels");
  revalidatePath("/admin/prize-claims");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/rewards");
  revalidatePath("/account/rewards");
}

export async function adminSpinWheelsAction(
  _previousState: AdminSpinWheelsActionState,
  formData: FormData
): Promise<AdminSpinWheelsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "rewards.manage")) {
    return {
      message: "You do not have permission to manage reward wheels.",
      status: "error"
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "ensure-default") {
      await ensureDefaultRewardWheel(actor.id);
      revalidateRewardsViews();

      return {
        message: "Default supporter wheel is ready in draft mode.",
        status: "success"
      };
    }

    if (intent === "wheel") {
      await createOrUpdateRewardWheel(wheelInput(formData), actor.id);
      revalidateRewardsViews();

      return {
        message: "Reward wheel saved.",
        status: "success"
      };
    }

    if (intent === "segment") {
      const segmentAction = formString(formData, "segmentAction") || "save";

      if (segmentAction === "move-up" || segmentAction === "move-down") {
        await moveRewardSegment(
          {
            direction: segmentAction === "move-up" ? "up" : "down",
            segmentId: formString(formData, "segmentId"),
            wheelId: formString(formData, "wheelId")
          },
          actor.id
        );
      } else {
        await createOrUpdateRewardSegment(segmentInput(formData), actor.id);
      }

      revalidateRewardsViews();

      return {
        message: segmentAction === "save" ? "Reward wheel segment saved." : "Reward wheel segment order updated.",
        status: "success"
      };
    }

    return {
      message: "Unknown reward wheel action.",
      status: "error"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Reward wheel action failed.",
      status: "error"
    };
  }
}
