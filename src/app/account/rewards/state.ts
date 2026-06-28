import type { RewardWheelSpinResult } from "@/lib/rewards/prize-service";

export type AccountRewardWheelActionState = {
  message: string;
  result: RewardWheelSpinResult | null;
  status: "idle" | "success" | "error";
};

export const initialAccountRewardWheelActionState: AccountRewardWheelActionState = {
  message: "",
  result: null,
  status: "idle"
};
