"use server";

import { revalidatePath } from "next/cache";
import { requireSignedInUser } from "@/lib/auth/guards";
import { RewardWheelSpinError, spinRewardWheel } from "@/lib/rewards/prize-service";
import type { AccountRewardWheelActionState } from "@/app/account/rewards/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateRewardWheelViews() {
  revalidatePath("/account/rewards");
  revalidatePath("/account/notifications");
  revalidatePath("/admin/prize-claims");
  revalidatePath("/admin/spin-wheels");
  revalidatePath("/rewards");
}

export async function accountRewardWheelAction(
  _previousState: AccountRewardWheelActionState,
  formData: FormData
): Promise<AccountRewardWheelActionState> {
  const user = await requireSignedInUser();

  try {
    const wheelId = formString(formData, "wheelId");

    if (!wheelId) {
      return {
        message: "Choose a reward wheel to spin.",
        result: null,
        status: "error"
      };
    }

    const result = await spinRewardWheel(user.id, wheelId);
    revalidateRewardWheelViews();

    return {
      message: result.message,
      result,
      status: "success"
    };
  } catch (error) {
    return {
      message:
        error instanceof RewardWheelSpinError || error instanceof Error
          ? error.message
          : "Reward wheel spin failed.",
      result: null,
      status: "error"
    };
  }
}
