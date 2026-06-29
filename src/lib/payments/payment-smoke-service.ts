import { prisma } from "@/lib/db/prisma";
import {
  paymentSmokeModeBlockReason,
  paymentSmokeScenarioLabels,
  paymentSmokeShippingFields,
  paymentSmokeVerification,
  type PaymentSmokeField,
  type PaymentSmokeScenarioId,
  type PaymentSmokeVerification
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
  recentResults: PaymentSmokeRecentResult[];
  scenarios: PaymentSmokeScenario[];
};

export type PaymentSmokeRecentResult = {
  amountPence: number;
  createdAt: string;
  id: string;
  paypalCaptureId: string | null;
  paypalOrderId: string | null;
  resultHref: string;
  scenarioId: PaymentSmokeScenarioId;
  status: string;
  targetLabel: string;
  title: string;
  verification: PaymentSmokeVerification;
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

function resultSort(a: PaymentSmokeRecentResult, b: PaymentSmokeRecentResult) {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export async function getPaymentSmokeData(userId: string): Promise<PaymentSmokeData> {
  const [paypal, user, musicTrack, shopVariant, starPurchases, musicPurchases, shopOrders] = await Promise.all([
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
    }),
    prisma.starPurchase.findMany({
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true,
        id: true,
        packageLabel: true,
        paypalCaptureId: true,
        paypalOrderId: true,
        stars: true,
        status: true,
        totalPence: true
      },
      take: 5,
      where: {
        userId
      }
    }),
    prisma.digitalTrackPurchase.findMany({
      include: {
        track: {
          select: {
            downloadUrl: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5,
      where: {
        buyerId: userId
      }
    }),
    prisma.order.findMany({
      include: {
        items: {
          orderBy: {
            id: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5,
      where: {
        userId
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
  const recentResults: PaymentSmokeRecentResult[] = [
    ...starPurchases.map((purchase) => ({
      amountPence: purchase.totalPence,
      createdAt: purchase.createdAt.toISOString(),
      id: purchase.id,
      paypalCaptureId: purchase.paypalCaptureId,
      paypalOrderId: purchase.paypalOrderId,
      resultHref: "/account/rewards",
      scenarioId: "stars" as const,
      status: purchase.status,
      targetLabel: `${purchase.packageLabel} / ${purchase.stars.toLocaleString("en-GB")} stars`,
      title: paymentSmokeScenarioLabels.stars,
      verification: paymentSmokeVerification({
        paypalCaptureId: purchase.paypalCaptureId,
        scenarioId: "stars",
        status: purchase.status
      })
    })),
    ...musicPurchases.map((purchase) => {
      const deliveryAvailable = Boolean(purchase.downloadUrl ?? purchase.track.downloadUrl);

      return {
        amountPence: purchase.pricePence,
        createdAt: purchase.createdAt.toISOString(),
        id: purchase.id,
        paypalCaptureId: purchase.paypalCaptureId,
        paypalOrderId: purchase.paypalOrderId,
        resultHref: "/account/downloads",
        scenarioId: "music" as const,
        status: purchase.status,
        targetLabel: `${purchase.trackTitle} by ${purchase.producerName}`,
        title: paymentSmokeScenarioLabels.music,
        verification: paymentSmokeVerification({
          deliveryAvailable,
          paypalCaptureId: purchase.paypalCaptureId,
          scenarioId: "music",
          status: purchase.status
        })
      };
    }),
    ...shopOrders.map((order) => ({
      amountPence: order.totalPence,
      createdAt: order.createdAt.toISOString(),
      id: order.id,
      paypalCaptureId: order.paypalCaptureId,
      paypalOrderId: order.paypalOrderId,
      resultHref: "/account/orders",
      scenarioId: "shop" as const,
      status: order.status,
      targetLabel:
        order.items.length === 1
          ? `${order.items[0].productName} / ${order.items[0].variantName}`
          : `${order.items.length} shop item${order.items.length === 1 ? "" : "s"}`,
      title: paymentSmokeScenarioLabels.shop,
      verification: paymentSmokeVerification({
        paypalCaptureId: order.paypalCaptureId,
        scenarioId: "shop",
        status: order.status
      })
    }))
  ].sort(resultSort).slice(0, 12);

  return {
    mode: paypal.settings.mode,
    recentResults,
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
