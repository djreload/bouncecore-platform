import type { AccountRewardWheelsData } from "../rewards/prize-service";
import type { AccountRewardsData } from "../rewards/stars-service";

export function buildMobileRewardsAccountPayload(starsData: AccountRewardsData, wheelData: AccountRewardWheelsData) {
  return {
    ...starsData,
    wallet: {
      balance: starsData.wallet.balance,
      updatedAt: starsData.wallet.updatedAt.toISOString()
    },
    rewardWheels: {
      recentClaims: wheelData.recentClaims,
      walletBalance: wheelData.walletBalance,
      wheels: wheelData.wheels
    }
  };
}
