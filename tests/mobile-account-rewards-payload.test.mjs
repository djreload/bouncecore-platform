import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileRewardsAccountPayload } from "../src/lib/mobile/account-rewards-payload-core.ts";

test("mobile account rewards payload includes serialized wallet and reward wheel data", () => {
  const payload = buildMobileRewardsAccountPayload(
    {
      orderStats: {
        orders: 1,
        spendPence: 1200
      },
      purchases: [],
      purchaseStats: {
        paidPurchases: 0,
        pendingPurchases: 0,
        purchasedStars: 0,
        spendPence: 0
      },
      rank: null,
      sentStats: {
        sendCount: 0,
        sentStars: 0
      },
      supporter: true,
      wallet: {
        balance: 75,
        updatedAt: new Date("2026-06-28T08:00:00.000Z")
      }
    },
    {
      recentClaims: [
        {
          createdAt: "2026-06-28T08:05:00.000Z",
          description: null,
          id: "claim-1",
          prizeType: "none",
          segmentLabel: "Try again",
          starAmount: 0,
          status: "fulfilled",
          title: "Try again",
          wheelName: "Supporter Wheel"
        }
      ],
      walletBalance: 75,
      wheels: [
        {
          canSpin: true,
          cooldownMinutes: 60,
          cooldownRemainingSeconds: 0,
          cooldownRetryAt: null,
          costStars: 5,
          description: null,
          id: "wheel-1",
          name: "Supporter Wheel",
          segments: [],
          slug: "supporter-wheel",
          totalWeight: 100,
          unavailableReason: null
        }
      ]
    }
  );

  assert.equal(payload.wallet.updatedAt, "2026-06-28T08:00:00.000Z");
  assert.equal(payload.wallet.balance, 75);
  assert.equal(payload.rewardWheels.walletBalance, 75);
  assert.equal(payload.rewardWheels.wheels[0].canSpin, true);
  assert.equal(payload.rewardWheels.recentClaims[0].id, "claim-1");
});
