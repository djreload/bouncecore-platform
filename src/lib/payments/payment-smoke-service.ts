import { prisma } from "@/lib/db/prisma";
import {
  paymentSmokeModeBlockReason,
  paymentSmokeScenarioLabels,
  paymentSmokeShippingFields,
  type PaymentSmokeField,
  type PaymentSmokeScenarioId
} from "@/lib/payments/payment-smoke-core";
import {
  getPayPalCheckoutReadiness,
  getPayPalIntegrationData,
  getPayPalMusicReadiness,
  getPayPalStarsReadiness
} from "@/lib/payments/paypal-service";
import { starPackages } from "@/lib/rewards/star-packages";

export type PaymentSmokeScenario = {
  action: string;
  amountPence: number | null;
  description: string;
  expectedResult: string;
  fields: PaymentSmokeField[];
  id: PaymentSmokeScenarioId;
  ready: boolean;
  reason: string | null;
  resultHref: string;
  targetLabel: string | null;
  title: string;
};

export type PaymentSmokeData = {
  mode: string;
  scenarios: PaymentSmokeScenario[];
};

function formatTarget(productName: string, variantName: string) {
  return `${productName} / ${variantName}`;
}

function scenarioReady(modeBlock: string | null, readiness: { ready: boolean; reason: string | null }, targetReason: string | null) {
  if (modeBlock) {
    return {
      ready: false,
      reason: modeBlock
    };
  }

  if (!readiness.ready) {
    return {
      ready: false,
      reason: readiness.reason ?? "PayPal checkout is not ready."
    };
  }

  if (targetReason) {
    return {
      ready: false,
      reason: targetReason
    };
  }

  return {
    ready: true,
    reason: null
  };
}

export async function getPaymentSmokeData(userId: string): Promise<PaymentSmokeData> {
  const [paypal, user, musicTrack, shopVariant] = await Promise.all([
    getPayPalIntegrationData(),
    prisma.user.findUniqueOrThrow({
      select: {
        displayName: true,
        email: true
      },
      where: {
        id: userId
      }
    }),
    prisma.digitalTrack.findFirst({
      orderBy: [
        {
          pricePence: "asc"
        },
        {
          createdAt: "asc"
        }
      ],
      select: {
        id: true,
        pricePence: true,
        producer: {
          select: {
            name: true
          }
        },
        title: true
      },
      where: {
        AND: [
          {
            downloadUrl: {
              not: null
            }
          },
          {
            downloadUrl: {
              not: ""
            }
          }
        ],
        pricePence: {
          gt: 0
        },
        producer: {
          userId: {
            not: userId
          }
        },
        purchases: {
          none: {
            buyerId: userId,
            status: "paid"
          }
        },
        status: "approved"
      }
    }),
    prisma.productVariant.findFirst({
      include: {
        product: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        {
          pricePence: "asc"
        },
        {
          sku: "asc"
        }
      ],
      where: {
        pricePence: {
          gt: 0
        },
        product: {
          status: "active"
        },
        stock: {
          gt: 0
        }
      }
    })
  ]);
  const modeBlock = paymentSmokeModeBlockReason(paypal.settings.mode);
  const starsReadiness = getPayPalStarsReadiness(paypal.settings, paypal.secretConfigured);
  const musicReadiness = getPayPalMusicReadiness(paypal.settings, paypal.secretConfigured);
  const shopReadiness = getPayPalCheckoutReadiness(paypal.settings, paypal.secretConfigured);
  const starPackage = [...starPackages].sort((a, b) => a.pricePence - b.pricePence)[0] ?? null;
  const starsState = scenarioReady(modeBlock, starsReadiness, starPackage ? null : "No stars package is configured.");
  const musicState = scenarioReady(modeBlock, musicReadiness, musicTrack ? null : "No approved paid music track is available for this admin user to buy.");
  const shopState = scenarioReady(modeBlock, shopReadiness, shopVariant ? null : "No active in-stock paid shop variant is available.");

  return {
    mode: paypal.settings.mode,
    scenarios: [
      {
        action: "/account/rewards/stars/checkout",
        amountPence: starPackage?.pricePence ?? null,
        description: "Starts a real PayPal order for the cheapest configured stars package.",
        expectedResult: "Return from PayPal should credit the wallet and create a paid stars purchase.",
        fields: starPackage
          ? [
              {
                name: "packageId",
                value: starPackage.id
              }
            ]
          : [],
        id: "stars",
        ready: starsState.ready,
        reason: starsState.reason,
        resultHref: "/account/rewards",
        targetLabel: starPackage ? `${starPackage.label} / ${starPackage.stars.toLocaleString("en-GB")} stars` : null,
        title: paymentSmokeScenarioLabels.stars
      },
      {
        action: "/music/checkout",
        amountPence: musicTrack?.pricePence ?? null,
        description: "Starts a real PayPal order for an approved paid track with a delivery URL.",
        expectedResult: "Return from PayPal should create a paid music purchase and enable account download access.",
        fields: musicTrack
          ? [
              {
                name: "trackId",
                value: musicTrack.id
              }
            ]
          : [],
        id: "music",
        ready: musicState.ready,
        reason: musicState.reason,
        resultHref: "/account/downloads",
        targetLabel: musicTrack ? `${musicTrack.title} by ${musicTrack.producer.name}` : null,
        title: paymentSmokeScenarioLabels.music
      },
      {
        action: "/shop/checkout",
        amountPence: shopVariant?.pricePence ?? null,
        description: "Starts a real PayPal order for one active in-stock merch variant using a sandbox shipping address.",
        expectedResult: "Return from PayPal should mark the order paid and decrement variant stock by one.",
        fields: shopVariant
          ? [
              {
                name: "variantId",
                value: shopVariant.id
              },
              {
                name: "quantity",
                value: "1"
              },
              ...paymentSmokeShippingFields(user)
            ]
          : [],
        id: "shop",
        ready: shopState.ready,
        reason: shopState.reason,
        resultHref: "/account/orders",
        targetLabel: shopVariant ? formatTarget(shopVariant.product.name, shopVariant.name) : null,
        title: paymentSmokeScenarioLabels.shop
      }
    ]
  };
}
