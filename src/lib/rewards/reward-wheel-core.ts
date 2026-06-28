export type RewardWheelSegmentOption = {
  id: string;
  status?: string;
  weight: number;
};

export type RewardWheelCooldownInput = {
  cooldownMinutes: number;
  lastSpinAt: Date | string | null;
  now?: Date;
};

export type RewardWheelCooldownState = {
  available: boolean;
  remainingSeconds: number;
  retryAt: Date | null;
};

export type RewardWheelSpinCostInput = {
  costStars: number;
  walletBalance: number;
};

export type RewardWheelSpinCostState = {
  balanceAfterSpin: number;
  canAfford: boolean;
  costStars: number;
  missingStars: number;
};

const maxRandom = 0.999999999999999;

export function activeRewardWheelSegments<T extends RewardWheelSegmentOption>(segments: readonly T[]) {
  return segments.filter((segment) => (segment.status === undefined || segment.status === "active") && segment.weight > 0);
}

export function getRewardWheelTotalWeight(segments: readonly RewardWheelSegmentOption[]) {
  return activeRewardWheelSegments(segments).reduce((total, segment) => total + segment.weight, 0);
}

export function pickWeightedRewardSegment<T extends RewardWheelSegmentOption>(
  segments: readonly T[],
  randomValue = Math.random()
): T {
  const eligibleSegments = activeRewardWheelSegments(segments);
  const totalWeight = getRewardWheelTotalWeight(eligibleSegments);

  if (!eligibleSegments.length || totalWeight <= 0) {
    throw new Error("Reward wheel needs at least one active weighted segment.");
  }

  const target = Math.min(Math.max(randomValue, 0), maxRandom) * totalWeight;
  let cursor = 0;

  for (const segment of eligibleSegments) {
    cursor += segment.weight;

    if (target < cursor) {
      return segment;
    }
  }

  return eligibleSegments[eligibleSegments.length - 1];
}

export function getRewardWheelCooldownState({
  cooldownMinutes,
  lastSpinAt,
  now = new Date()
}: RewardWheelCooldownInput): RewardWheelCooldownState {
  if (!lastSpinAt || cooldownMinutes <= 0) {
    return {
      available: true,
      remainingSeconds: 0,
      retryAt: null
    };
  }

  const lastSpinDate = new Date(lastSpinAt);
  const retryAt = new Date(lastSpinDate.getTime() + cooldownMinutes * 60_000);
  const remainingSeconds = Math.max(0, Math.ceil((retryAt.getTime() - now.getTime()) / 1000));

  return {
    available: remainingSeconds <= 0,
    remainingSeconds,
    retryAt: remainingSeconds > 0 ? retryAt : null
  };
}

export function getRewardWheelSpinCostState({
  costStars,
  walletBalance
}: RewardWheelSpinCostInput): RewardWheelSpinCostState {
  const normalizedCost = Math.max(0, Math.trunc(costStars));
  const normalizedBalance = Math.max(0, Math.trunc(walletBalance));
  const canAfford = normalizedBalance >= normalizedCost;

  return {
    balanceAfterSpin: canAfford ? normalizedBalance - normalizedCost : normalizedBalance,
    canAfford,
    costStars: normalizedCost,
    missingStars: canAfford ? 0 : normalizedCost - normalizedBalance
  };
}

export function rewardWheelResultStatus(prizeType: string) {
  return prizeType === "none" ? "fulfilled" : "pending";
}
